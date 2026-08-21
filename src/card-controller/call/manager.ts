import { createBackchannel } from '../../components-lib/live/backchannel/factory';
import {
  BackchannelError,
  type Backchannel,
} from '../../components-lib/live/backchannel/types';
import { createNotificationFromText } from '../../components-lib/notification/factory';
import type { ConditionStateChange } from '../../condition-trigger/conditions/types';
import { localize } from '../../localize/localize';
import { Generation } from '../../utils/concurrency/generation';
import { Timer } from '../../utils/timer';
import { getStreamCameraID } from '../../view/substream';
import type { View } from '../../view/view';
import type { CardCallAPI } from '../types';
import { SubstreamViewModifier } from '../view/modifiers/substream';
import { Ringtone } from './ringtone';
import type { CallSession } from './types';

export class CallManager {
  private _api: CardCallAPI;
  private _call: CallSession | null = null;
  private _ringtone = new Ringtone();
  private _unansweredTimer = new Timer();

  private _backchannel: Backchannel | null = null;

  // Identifies the current init/uninit cycle so an in-flight `start()` or
  // `answer()` resuming from its microphone-connect await can detect that its
  // CallManager was torn down -- or torn down and re-initialized -- while it
  // was suspended, and bail before installing a session or a ringtone. Without
  // this guard the resumed tail leaks audio onto the shared lock from an
  // instance the user can no longer see or control, and may install state into
  // a fresh lifecycle from a request that belongs to the previous one.
  private _initGeneration = new Generation();

  constructor(api: CardCallAPI) {
    this._api = api;
  }

  public initialize(): void {
    // A call runs on the live view of a specific camera. The listener watches
    // condition state so the call can be ended when the view, camera, or
    // engaged substream moves off what the call started on.
    this._api.getConditionStateManager().addListener(this._handleConditionStateChange);
  }

  // =========================================================================
  // Readers
  // =========================================================================

  public isActive(): boolean {
    return !!this._call;
  }

  public getCall(): CallSession | null {
    return this._call;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  // Returns true iff the requested call is active after this returns, false
  // otherwise.
  public async start(options?: {
    cameraID?: string;
    streamID?: string;
    inbound?: boolean;
  }): Promise<boolean> {
    const inbound = !!options?.inbound;
    const view = this._api.getViewManager().getView();

    const parentID = options?.cameraID ?? view?.camera;
    if (!view || !parentID) {
      return false;
    }

    if (
      !this._api
        .getCameraManager()
        .getStore()
        .getCameraIDsWithCapability('live')
        .has(parentID)
    ) {
      this._notifyError('error.call_invalid_target', { inbound });
      return false;
    }

    const targetID = options?.streamID
      ? this._validateStream(parentID, options.streamID, inbound)
      : this._pickDefaultTarget(view, parentID, inbound);
    if (!targetID) {
      return false;
    }

    // `callCameraID` is the substream carrying the call audio -- absent when
    // the call runs on the parent camera itself.
    const callCameraID = targetID === parentID ? undefined : targetID;

    let existingCall = this._call;
    if (
      existingCall &&
      existingCall.cameraID === parentID &&
      existingCall.callCameraID === callCameraID
    ) {
      // This exact call (same parent camera and stream) is already running --
      // the caller has what they asked for.
      return true;
    }

    if (!this._microphonePreflight(inbound)) {
      return false;
    }

    // An inbound call has no use for the microphone until it is answered, and
    // it arrives without the user gesture that browsers may require before
    // granting microphone access -- so connecting here would let a refusal stop
    // the call from ever ringing. The connect is deferred to `answer()`. An
    // outbound call is answered by construction and needs it immediately.
    if (!inbound && !(await this._grantTransmissionAndConnect())) {
      return false;
    }

    // Re-read: another `start()` may have installed a session while the
    // microphone connect was in flight. Acting on the reading from before the
    // await would skip the supersede handling below, leaving that session's
    // microphone marking and view state stranded with nothing able to undo
    // them.
    existingCall = this._call;

    // Store the previous view so it can be restored later. A call superseding
    // another inherits the earlier call's previous view -- the user never left
    // the call. `queryResults` are dropped (re-fetched fresh on restore).
    const previousView = existingCall
      ? existingCall.previousView
      : view.evolve({ queryResults: null });

    const needsNavigation = !view.is('live') || view.camera !== parentID;

    // An inbound call must not yank the user away from a call they care about.
    // Skip the new start request if the existing call is either manual
    // (user-initiated) or already answered (user engaged). Newer inbound rings
    // still replace older unanswered ones.
    if (existingCall) {
      if (inbound && (existingCall.answered || !existingCall.inbound)) {
        return false;
      }
      // The replacement call inherits the microphone.
      this._end(false, { retainMicrophone: true });
    }

    // Outbound calls are answered by construction (the user initiated them);
    // inbound calls start unanswered and wait for an explicit Answer.
    const answered = !inbound;

    this._call = {
      cameraID: parentID,
      ...(callCameraID && { callCameraID }),
      previousView,
      inbound,
      answered,
    };

    // `_grantTransmissionAndConnect` above reported the need for transmission
    // before awaiting the microphone connect; a call ending during that await
    // may have withdrawn it since, so an answered session reports it again --
    // ahead of the view and condition state below, whose listeners may replace
    // the session. A ringing session reports nothing: it transmits nothing,
    // and reporting inactive could end a transmission another request is
    // using.
    if (answered) {
      this._api.getMicrophoneManager().setTransmissionActive(true);
    }

    this._api.getViewManager().setViewByParameters({
      ...(needsNavigation && {
        params: { view: 'live', camera: parentID },
      }),
      modifiers: [new SubstreamViewModifier({ stream: callCameraID, camera: parentID })],
      force: true,
    });
    this._api
      .getConditionStateManager()
      .setState({ call: answered ? 'answered' : 'ringing' });

    // Re-read the session as the listeners triggered by the call phase may have
    // already have changed the state.
    const call = this._call;
    if (!call) {
      return false;
    }

    // Ring only if still unanswered.
    const callConfig = this._api.getConfigManager().getConfig()?.live.controls.call;
    const ringtoneConfig = callConfig?.ringtone;
    if (
      call.inbound &&
      !call.answered &&
      ringtoneConfig &&
      ringtoneConfig.type !== 'none'
    ) {
      this._ringtone.start(ringtoneConfig);
    }

    // Arm the unanswered-call timeout: if the inbound call rings for this long
    // without being answered, end it.
    const timeoutSeconds = callConfig?.unanswered_timeout_seconds ?? 0;
    if (call.inbound && !call.answered && timeoutSeconds > 0) {
      this._unansweredTimer.start(timeoutSeconds, () => this.end());
    }

    return call.answered ? await this._openBackchannel(call, inbound) : true;
  }

  // Ends the call and returns to the pre-call view. Returns true iff a call was
  // actually ended (false when there's no active call).
  public end(): boolean {
    return this._end(true);
  }

  // Marks an inbound ringing call as answered: connects the microphone, stops
  // the ringtone, cancels the unanswered timer, and lets the normal call
  // controls take over. Returns true iff the call was answered. No-op (returns
  // false) if there is no call or it's already answered; rejecting a ringing
  // call uses `end()` (same teardown).
  public async answer(): Promise<boolean> {
    const call = this._call;
    if (!call || call.answered) {
      return false;
    }

    // The user has acknowledged the ring, so silence it before the microphone
    // connect, which may put a browser permission prompt on screen.
    this._ringtone.stop();

    // An inbound call rings without the microphone, so this is where it is
    // connected -- under the user gesture that answering provides. The call is
    // left ringing on failure so it can be answered again.
    if (!(await this._grantTransmissionAndConnect())) {
      return false;
    }

    // The call may have ended, or been superseded by another, while the
    // microphone connect was in flight -- there is then nothing left to answer.
    if (this._call !== call) {
      this._revokeTransmissionIfNoAnsweredCall();
      return false;
    }

    this._unansweredTimer.stop();
    // Replace (don't mutate) so Lit identity checks downstream pick up the
    // change. The `update()` below forces card.ts to re-render and re-read
    // `getCall()`, propagating the new session to the carousel.
    const answeredCall = { ...call, answered: true };
    this._call = answeredCall;
    this._api.getConditionStateManager().setState({ call: 'answered' });
    this._api.getCardElementManager().update();

    return await this._openBackchannel(answeredCall, false);
  }

  // Ends the active call iff every supplied predicate matches the session.
  // Returns true iff a call was actually ended.
  public endIf(options: {
    cameraID?: string;
    inbound?: boolean;
    answered?: boolean;
  }): boolean {
    if (!this._call) {
      return false;
    }
    if (options.cameraID !== undefined && this._call.cameraID !== options.cameraID) {
      return false;
    }
    if (options.inbound !== undefined && this._call.inbound !== options.inbound) {
      return false;
    }
    if (options.answered !== undefined && this._call.answered !== options.answered) {
      return false;
    }
    return this.end();
  }

  // Opens the backchannel for an answered call. Failing to open it ends
  // the call, so the user is never left with call controls when they cannot be
  // heard. Returns true iff the call is still running.
  private async _openBackchannel(call: CallSession, inbound: boolean): Promise<boolean> {
    const targetID = call.callCameraID ?? call.cameraID;
    const hass = this._api.getHASSManager().getHASS();
    const camera = this._api.getCameraManager().getStore().getCamera(targetID);
    const stream = this._api.getMicrophoneManager().getStream();

    const backchannel =
      hass && camera
        ? createBackchannel(hass, camera, (error) =>
            this._reportBackchannelLoss(call, error),
          )
        : null;
    if (!backchannel || !stream) {
      this._notifyError('error.call_no_two_way_audio', { inbound });
      this._end(true);
      return false;
    }

    this._backchannel = backchannel;

    try {
      await backchannel.start(stream);
    } catch (error: unknown) {
      if (this._call !== call) {
        return false;
      }
      this._closeBackchannel();
      this._notifyBackchannelError(error, inbound);
      this._end(true);
      return false;
    }

    if (this._call !== call) {
      backchannel.stop();
      return false;
    }
    return true;
  }

  private _closeBackchannel(): void {
    this._backchannel?.stop();
    this._backchannel = null;
  }

  private _reportBackchannelLoss(call: CallSession, error: BackchannelError): void {
    if (this._call !== call) {
      return;
    }
    this._notifyBackchannelError(error, call.inbound);
  }

  private _notifyBackchannelError(error: unknown, inbound: boolean): void {
    const reason = error instanceof BackchannelError ? error.reason : 'failed';

    // Abandonment means this manager closed the backchannel itself, because the
    // call ended or was replaced. Nothing failed, so there is nothing to report.
    if (reason === 'abandoned') {
      return;
    }

    const messageKey =
      reason === 'no_two_way_audio'
        ? 'error.call_no_two_way_audio'
        : reason === 'no_microphone'
          ? 'error.call_microphone_failed'
          : 'error.call_camera_unreachable';

    this._notifyError(messageKey, {
      inbound,
      ...(error instanceof BackchannelError &&
        error.description && { context: error.description }),
    });
  }

  // The microphone could not be used for the call, so it is connected but the
  // user cannot be heard. `description` is what the reporting layer knows about
  // the failure, when it knows anything.
  public reportCallMicrophoneError(targetID: string, description?: string): void {
    const call = this._call;

    // A report that no longer matches the call in progress describes an attempt
    // the user has already moved past, e.g. the call ended before the provider
    // finished reporting.
    if (!call || !call.answered || call.cameraID !== targetID) {
      return;
    }

    this._notifyError('error.call_microphone_failed', { context: description });
  }

  // Tears down everything `initialize()` set up: stops any in-flight ringtone
  // and unanswered timer, drops the active call session, clears the call
  // condition state, and de-registers the condition-state listener. Driven by
  // the card element lifecycle: called from `elementDisconnected`.
  //
  // Safe to re-initialize afterwards via `initialize()`.
  public uninitialize(): void {
    this._initGeneration.invalidate();
    this._ringtone.stop();
    this._unansweredTimer.stop();
    this._closeBackchannel();
    this._api.getMicrophoneManager().setTransmissionActive(false);
    if (this._call) {
      this._call = null;
      this._api.getConditionStateManager().setState({ call: 'idle' });
    }
    this._api
      .getConditionStateManager()
      .removeListener(this._handleConditionStateChange);
  }

  // `restoreView` navigates back to the pre-call view -- the symmetric
  // counterpart of `call_start`'s navigation -- for an explicit `call_end`. It
  // is `false` for auto-ends (navigating away, camera/substream change), where
  // the user has already chosen a destination and the pre-call view is
  // deliberately not reinstated; only the manager's own auto-end paths pass it.
  // `retainMicrophone` does not relinquish the microphone.
  // Returns true iff a call was actually ended.
  private _end(restoreView: boolean, options?: { retainMicrophone?: boolean }): boolean {
    if (!this._call) {
      return false;
    }
    const call = this._call;
    const previousView = call.previousView;

    // Silence any ringtone before the navigation.
    this._ringtone.stop();
    this._unansweredTimer.stop();

    this._closeBackchannel();

    // Clear the session first: ending the call dispatches a view change, and
    // the resulting condition-state change must not see this (now-ending) call
    // and recurse.
    this._call = null;

    if (!options?.retainMicrophone && call.answered) {
      this._api.getMicrophoneManager().setTransmissionActive(false);
    }

    const viewManager = this._api.getViewManager();

    // Navigate back only on an explicit end, and only when the call actually
    // moved away from where the user was (a call started from its own live
    // view has nowhere to return). The previous view's query is re-executed
    // so results are fresh.
    if (
      restoreView &&
      (previousView.view !== 'live' || previousView.camera !== call.cameraID)
    ) {
      void viewManager.setViewByParametersWithExistingQuery({
        baseView: previousView,
        force: true,
      });
    } else {
      // Otherwise stay where we are and just undo the call's substream change
      // on its own camera, reading the pre-call value.
      const previousStream = getStreamCameraID(previousView, call.cameraID);
      viewManager.setViewByParameters({
        modifiers: [
          new SubstreamViewModifier({
            ...(previousStream &&
              previousStream !== call.cameraID && { stream: previousStream }),
            camera: call.cameraID,
          }),
        ],
        force: true,
      });
    }
    this._api.getConditionStateManager().setState({ call: 'idle' });
    return true;
  }

  // Ends the call once it can no longer be conducted from where it started
  // (e.g. view change). Only reacts to changes in view/camera/substream
  // themselves -- not to unrelated state updates (e.g. `mediaLoadedInfo`)
  // that may arrive before the view-manager's own state update.
  private _handleConditionStateChange = (stateChange: ConditionStateChange): void => {
    if (!this._call) {
      return;
    }

    const viewRelevantChange =
      stateChange.change.view !== undefined ||
      stateChange.change.camera !== undefined ||
      stateChange.change.substreamID !== undefined;
    if (
      viewRelevantChange &&
      (stateChange.new.view !== 'live' ||
        stateChange.new.camera !== this._call.cameraID ||
        stateChange.new.substreamID !== this._call.callCameraID)
    ) {
      this._end(false);
    }
  };

  // =========================================================================
  // Helpers
  // =========================================================================

  // `context` is a diagnostic the user can quote when reporting the problem.
  private _notifyError(
    messageKey: string,
    options?: { inbound?: boolean; context?: string },
  ): void {
    // An inbound call the user has not answered yet is not something they have
    // asked for, so a failure to place it is not worth interrupting them with.
    if (options?.inbound) {
      return;
    }
    const context = options?.context;
    this._api.getNotificationManager().setNotification(
      createNotificationFromText(localize(messageKey), {
        heading: { text: localize('error.call_unavailable_heading') },
        ...(context && { context }),
      }),
    );
  }

  // Returns `true` to proceed, `false` to abort (with a notification surfaced
  // unless `inbound` is set).
  private _microphonePreflight(inbound: boolean): boolean {
    const microphoneManager = this._api.getMicrophoneManager();

    if (!microphoneManager.isSupported()) {
      this._notifyError('error.call_microphone_unsupported', { inbound });
      return false;
    }

    // An earlier microphone denial does not stop an inbound call: the ring
    // needs no microphone, and `answer()` retries the connect -- succeeding
    // there clears the denial, and failing there reports it. An outbound call
    // needs the microphone immediately, so a known denial ends it here.
    if (!inbound && microphoneManager.isForbidden()) {
      this._notifyError('error.call_microphone_forbidden', { inbound });
      return false;
    }

    return true;
  }

  private _revokeTransmissionIfNoAnsweredCall(): void {
    if (!this._call?.answered) {
      this._api.getMicrophoneManager().setTransmissionActive(false);
    }
  }

  // The microphone manager releases a stream that connects while transmission
  // is inactive, so transmission is activated first and revoked on failure.
  // Returns true iff the microphone is connected and this request is still
  // current.
  private async _grantTransmissionAndConnect(): Promise<boolean> {
    this._api.getMicrophoneManager().setTransmissionActive(true);
    if (!(await this._connectMicrophone())) {
      this._revokeTransmissionIfNoAnsweredCall();
      return false;
    }
    return true;
  }

  // Connects the microphone for a call. Returns true iff it is connected and
  // this request still belongs to the current init/uninit lifecycle. A denied
  // connect is surfaced as a notification; a connect superseded by a newer
  // request fails silently (the newer request owns the outcome).
  private async _connectMicrophone(): Promise<boolean> {
    const microphoneManager = this._api.getMicrophoneManager();
    if (microphoneManager.isConnected()) {
      return true;
    }

    const initGeneration = this._initGeneration.current();
    let connected = false;
    let forbidden = false;
    try {
      connected = await microphoneManager.connect();
    } catch {
      // Reported below, once this request is known to still be the current one.
      forbidden = true;
    }

    // If the init/uninit lifecycle advanced while the connect was in flight,
    // this request belongs to a previous lifecycle: the state it would act on
    // is gone, and a notification would be surfaced onto a torn-down
    // NotificationManager.
    if (!this._initGeneration.isCurrent(initGeneration)) {
      return false;
    }

    if (forbidden) {
      this._notifyError('error.call_microphone_forbidden');
    }
    return connected;
  }

  private _hasCallCapability(cameraID: string): boolean {
    return !!this._api
      .getCameraManager()
      .getCameraCapabilities(cameraID)
      ?.has('2-way-audio');
  }

  // Validate an explicitly-requested call stream: it must be `cameraID` itself
  // or one of its 2-way-audio dependencies.
  private _validateStream(
    cameraID: string,
    streamID: string,
    inbound: boolean,
  ): string | null {
    const eligibleCameraIDs = this._api
      .getCameraManager()
      .getStore()
      .getAllDependentCameras(cameraID, '2-way-audio');
    if (!eligibleCameraIDs.has(streamID)) {
      this._notifyError('error.call_invalid_target', { inbound });
      return null;
    }
    return streamID;
  }

  // Pick the default call target. Prefer the currently-engaged stream when
  // it's call-capable (keeps the user's substream selection intact). Else
  // fall back to the parent itself (if call-capable) or the first eligible
  // dependency. Returns null + notification if neither path finds a target.
  private _pickDefaultTarget(
    view: View,
    parentID: string,
    inbound: boolean,
  ): string | null {
    const currentStream = getStreamCameraID(view, parentID);
    if (currentStream && this._hasCallCapability(currentStream)) {
      return currentStream;
    }

    const candidates = [
      ...this._api
        .getCameraManager()
        .getStore()
        .getAllDependentCameras(parentID, '2-way-audio'),
    ];
    if (!candidates.length) {
      this._notifyError('error.call_no_two_way_audio', { inbound });
      return null;
    }
    return candidates[0];
  }
}
