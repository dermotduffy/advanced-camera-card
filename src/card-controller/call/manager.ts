import { createBackchannel } from '../../components-lib/live/backchannel/factory';
import {
  BackchannelAbandonedError,
  BackchannelError,
  type Backchannel,
  type BackchannelFailureReason,
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

const BACKCHANNEL_FAILURE_MESSAGE_KEYS: Record<BackchannelFailureReason, string> = {
  disconnected: 'error.call_connection_lost',
  failed: 'error.call_camera_unreachable',
  no_microphone: 'error.call_microphone_failed',
  no_two_way_audio: 'error.call_no_two_way_audio',
};

export class CallManager {
  private _api: CardCallAPI;
  private _call: CallSession | null = null;
  private _ringtone = new Ringtone();
  private _unansweredTimer = new Timer();

  private _backchannel: Backchannel | null = null;

  // The call whose microphone and backchannel are connecting: an outbound call
  // not yet installed, or the answered form of the ringing inbound call. It
  // becomes `_call` only once its backchannel connects.
  private _connecting: CallSession | null = null;

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

  public isConnecting(): boolean {
    return !!this._connecting;
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
    // The user is waiting on the connecting call, so no other call replaces it.
    if (this._connecting) {
      return false;
    }

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

    const existingCall = this._call;
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

    // An inbound call must not yank the user away from a call they care about.
    // Skip the new start request if the existing call is either manual
    // (user-initiated) or already answered (user engaged). Newer inbound rings
    // still replace older unanswered ones.
    if (existingCall && inbound && (existingCall.answered || !existingCall.inbound)) {
      return false;
    }

    // Store the previous view so it can be restored later. A call superseding
    // another inherits the earlier call's previous view -- the user never left
    // the call. `queryResults` are dropped (re-fetched fresh on restore).
    const previousView = existingCall
      ? existingCall.previousView
      : view.evolve({ queryResults: null });

    if (existingCall) {
      // The replacement call inherits the microphone.
      this._end(false, { retainMicrophone: true });
    }

    // Outbound calls are answered by construction (the user initiated them);
    // inbound calls start unanswered and wait for an explicit Answer.
    const call: CallSession = {
      cameraID: parentID,
      ...(callCameraID && { callCameraID }),
      previousView,
      inbound,
      answered: !inbound,
    };

    // An inbound call has no use for the microphone until it is answered, and
    // it arrives without the user gesture that browsers may require before
    // granting microphone access -- so connecting here would let a refusal stop
    // the call from ever ringing. The connect is deferred to `answer()`.
    if (inbound) {
      return this._ring(call);
    }
    if (!(await this._connect(call))) {
      return false;
    }

    this._call = call;
    this._showCall(call);
    this._api.getConditionStateManager().setState({ call: 'answered' });
    this._api.getCardElementManager().update();

    // Listeners triggered by the call phase may have ended the call.
    return this._call === call;
  }

  // Ends the call and returns to the pre-call view. Returns true iff a call was
  // actually ended (false when there's no active call).
  public end(): boolean {
    return this._end(true);
  }

  // Marks an inbound ringing call as answered: connects the microphone, stops
  // the ringtone, cancels the unanswered timer, and lets the normal call
  // controls take over. Returns true iff the call was answered. No-op (returns
  // false) if there is no call, it's already answered, or it is being
  // answered; rejecting a ringing call uses `end()` (same teardown).
  public async answer(): Promise<boolean> {
    const call = this._call;
    if (!call || call.answered || this._connecting) {
      return false;
    }

    // The user has acknowledged the ring, so silence it before the microphone
    // connect, which may put a browser permission prompt on screen.
    this._ringtone.stop();

    // Replace (don't mutate) so Lit identity checks downstream pick up the
    // change. The `update()` below forces card.ts to re-render and re-read
    // `getCall()`, propagating the new session to the carousel.
    const answeredCall = { ...call, answered: true };

    // The call is left ringing on a microphone failure so it can be answered
    // again.
    if (!(await this._connect(answeredCall))) {
      return false;
    }

    this._call = answeredCall;
    this._api.getConditionStateManager().setState({ call: 'answered' });
    this._api.getCardElementManager().update();

    // Listeners triggered by the call phase may have ended the call.
    return this._call === answeredCall;
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
    const answered = this._call.answered || !!this._connecting;
    if (options.answered !== undefined && answered !== options.answered) {
      return false;
    }
    return this.end();
  }

  private _ring(call: CallSession): boolean {
    this._call = call;
    this._showCall(call);
    this._api.getConditionStateManager().setState({ call: 'ringing' });

    // Listeners triggered by the call phase may have ended the call.
    if (this._call !== call) {
      return false;
    }

    const callConfig = this._api.getConfigManager().getConfig()?.live.controls.call;
    const ringtoneConfig = callConfig?.ringtone;
    if (ringtoneConfig && ringtoneConfig.type !== 'none') {
      this._ringtone.start(ringtoneConfig);
    }

    // Arm the unanswered-call timeout: if the inbound call rings for this long
    // without being answered, end it.
    const timeoutSeconds = callConfig?.unanswered_timeout_seconds ?? 0;
    if (timeoutSeconds > 0) {
      this._unansweredTimer.start(timeoutSeconds, () => this.end());
    }
    return true;
  }

  // Navigates to the live view of the call's camera, engaging the call stream.
  private _showCall(call: CallSession): void {
    const view = this._api.getViewManager().getView();
    const needsNavigation = !view?.is('live') || view.camera !== call.cameraID;
    this._api.getViewManager().setViewByParameters({
      ...(needsNavigation && {
        params: { view: 'live', camera: call.cameraID },
      }),
      modifiers: [
        new SubstreamViewModifier({ stream: call.callCameraID, camera: call.cameraID }),
      ],
      force: true,
    });
  }

  // Connects the microphone and the backchannel for an answered `call`, held in
  // `_connecting` meanwhile so the card can show it connecting. A backchannel
  // failure ends the call, so the user is never shown call controls when they
  // cannot be heard. Returns true iff the backchannel connected and `call` is
  // still wanted; the caller then installs it.
  private async _connect(call: CallSession): Promise<boolean> {
    this._connecting = call;
    this._api.getCardElementManager().update();

    // The microphone manager releases a stream that connects while transmission
    // is inactive, so transmission is activated first.
    const microphoneManager = this._api.getMicrophoneManager();
    microphoneManager.setTransmissionActive(true);
    const microphoneConnected = await this._connectMicrophone();
    if (this._connecting !== call) {
      return false;
    }
    if (!microphoneConnected) {
      this._abandonConnect();
      return false;
    }

    this._unansweredTimer.stop();

    const targetID = call.callCameraID ?? call.cameraID;
    const hass = this._api.getHASSManager().getHASS();
    const camera = this._api.getCameraManager().getStore().getCamera(targetID);
    const stream = microphoneManager.getStream();

    const backchannel =
      hass && camera
        ? createBackchannel(hass, camera, (error) =>
            this._reportBackchannelLoss(call, error),
          )
        : null;
    if (!backchannel || !stream) {
      this._failConnect(new BackchannelError('no_two_way_audio'));
      return false;
    }

    this._backchannel = backchannel;

    try {
      await backchannel.start(stream);
    } catch (error: unknown) {
      if (this._connecting === call) {
        this._failConnect(error);
      }
      return false;
    }

    if (this._connecting !== call) {
      return false;
    }
    this._connecting = null;
    return true;
  }

  // Stops connecting, leaving any ringing call in place.
  private _abandonConnect(): void {
    this._connecting = null;
    this._closeBackchannel();

    this._api.getMicrophoneManager().setTransmissionActive(false);
    this._api.getCardElementManager().update();
  }

  private _failConnect(error: unknown): void {
    this._notifyBackchannelError(error);
    this._abandonConnect();
    this._end(true);
  }

  private _closeBackchannel(): void {
    this._backchannel?.stop();
    this._backchannel = null;
  }

  // Ends a call whose backchannel was lost, so the user is not left with call
  // controls when they can no longer be heard.
  private _reportBackchannelLoss(call: CallSession, error: BackchannelError): void {
    if (this._call !== call) {
      return;
    }
    this._notifyBackchannelError(error);
    this._end(false);
  }

  // A backchannel only exists once the user started or answered a call, so
  // its failures are always reported, even for an inbound call.
  private _notifyBackchannelError(error: unknown): void {
    // Abandonment means this manager closed the backchannel itself, because the
    // call ended or was replaced. Nothing failed, so there is nothing to report.
    if (error instanceof BackchannelAbandonedError) {
      return;
    }

    const reason = error instanceof BackchannelError ? error.reason : 'failed';

    this._notifyError(BACKCHANNEL_FAILURE_MESSAGE_KEYS[reason], {
      ...(error instanceof BackchannelError &&
        error.description && { context: error.description }),
    });
  }

  // Tears down everything `initialize()` set up: stops any in-flight ringtone
  // and unanswered timer, drops the active and connecting call sessions, clears
  // the call condition state, and de-registers the condition-state listener.
  // Driven by the card element lifecycle: called from `elementDisconnected`.
  //
  // Safe to re-initialize afterwards via `initialize()`.
  public uninitialize(): void {
    this._initGeneration.invalidate();
    this._ringtone.stop();
    this._unansweredTimer.stop();
    this._connecting = null;
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

    // Ending a call the user is answering drops the answer too.
    if (this._connecting) {
      this._abandonConnect();
    }

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
    const viewRelevantChange =
      stateChange.change.view !== undefined ||
      stateChange.change.camera !== undefined ||
      stateChange.change.substreamID !== undefined;
    if (!viewRelevantChange) {
      return;
    }

    // An outbound call is shown only once connected, so moving elsewhere while
    // it connects means the user no longer wants it.
    if (!this._call) {
      if (this._connecting) {
        this._abandonConnect();
      }
      return;
    }

    if (
      stateChange.new.view !== 'live' ||
      stateChange.new.camera !== this._call.cameraID ||
      stateChange.new.substreamID !== this._call.callCameraID
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
