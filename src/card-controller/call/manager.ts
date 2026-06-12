import { createNotificationFromText } from '../../components-lib/notification/factory';
import { ConditionStateChange } from '../../condition-trigger/conditions/types';
import { localize } from '../../localize/localize';
import { Timer } from '../../utils/timer';
import { getStreamCameraID } from '../../view/substream';
import { View } from '../../view/view';
import { CardCallAPI } from '../types';
import { SubstreamViewModifier } from '../view/modifiers/substream';
import { Ringtone } from './ringtone';
import { CallSession } from './types';

export class CallManager {
  private _api: CardCallAPI;
  private _call: CallSession | null = null;
  private _ringtone = new Ringtone();
  private _unansweredTimer = new Timer();

  // Identifies the current init/uninit cycle so an in-flight `start()`
  // resuming from its microphone-connect await can detect that its CallManager
  // was torn down -- or torn down and re-initialized -- while it was suspended
  // and bail before installing a session or ringtone. Without this guard the
  // resumed tail leaks audio onto the shared lock from an instance the user
  // can no longer see or control, and may install state into a fresh
  // lifecycle from a request that belongs to the previous one.
  private _initEpoch = 0;

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
      this._notifyError('error.call_invalid_target', inbound);
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

    const initEpoch = this._initEpoch;
    const microphoneConnected = await this._connectMicrophone();
    // If the init/uninit lifecycle advanced while the microphone connect was
    // in flight, this request belongs to a previous lifecycle -- the view we
    // captured may be stale, the triggering context is gone, and there is no
    // clean teardown path for state we'd install here. Bail before touching
    // `_call`, the ringtone lock, or surfacing a notification onto a torn-down
    // NotificationManager.
    if (initEpoch !== this._initEpoch) {
      return false;
    }
    if (!microphoneConnected) {
      this._notifyError('error.call_microphone_forbidden', inbound);
      return false;
    }

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
      this._end(false);
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

    this._api.getViewManager().setViewByParameters({
      ...(needsNavigation && {
        params: { view: 'live', camera: parentID },
      }),
      modifiers: [new SubstreamViewModifier({ stream: callCameraID, camera: parentID })],
      force: true,
    });
    this._api.getConditionStateManager().setState({ call: true });

    // Re-read the session as the listeners triggered by `call: true` may have
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
    return true;
  }

  // Ends the call and returns to the pre-call view. Returns true iff a call was
  // actually ended (false when there's no active call).
  public end(): boolean {
    return this._end(true);
  }

  // Marks an inbound ringing call as answered: stops the ringtone, cancels
  // the unanswered timer, and lets the normal call controls take over.
  // No-op (returns false) if there is no call or it's already answered;
  // rejecting a ringing call uses `end()` (same teardown).
  public answer(): boolean {
    if (!this._call || this._call.answered) {
      return false;
    }
    this._ringtone.stop();
    this._unansweredTimer.stop();
    // Replace (don't mutate) so Lit identity checks downstream pick up the
    // change. The `update()` below forces card.ts to re-render and re-read
    // `getCall()`, propagating the new session to the carousel.
    this._call = { ...this._call, answered: true };
    this._api.getCardElementManager().update();
    return true;
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

  // Tears down everything `initialize()` set up: stops any in-flight ringtone
  // and unanswered timer, drops the active call session, clears the call
  // condition state, and de-registers the condition-state listener. Driven by
  // the card element lifecycle: called from `elementDisconnected`.
  //
  // Safe to re-initialize afterwards via `initialize()`.
  public uninitialize(): void {
    this._initEpoch++;
    this._ringtone.stop();
    this._unansweredTimer.stop();
    if (this._call) {
      this._call = null;
      this._api.getConditionStateManager().setState({ call: false });
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
  // Returns true iff a call was actually ended.
  private _end(restoreView: boolean): boolean {
    if (!this._call) {
      return false;
    }
    const call = this._call;
    const previousView = call.previousView;

    // Silence any ringtone before the navigation.
    this._ringtone.stop();
    this._unansweredTimer.stop();

    // Clear the session first: ending the call dispatches a view change, and
    // the resulting condition-state change must not see this (now-ending) call
    // and recurse.
    this._call = null;

    const viewManager = this._api.getViewManager();

    // Navigate back only on an explicit end, and only when the call actually
    // moved away from where the user was (a call started from its own live
    // view has nowhere to return). The previous view's query is re-executed
    // so results are fresh.
    if (
      restoreView &&
      (previousView.view !== 'live' || previousView.camera !== call.cameraID)
    ) {
      viewManager.setViewByParametersWithExistingQuery({
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
    this._api.getConditionStateManager().setState({ call: false });
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

  private _notifyError(messageKey: string, inbound: boolean): void {
    if (inbound) {
      // Don't show errors on inbound calls.
      return;
    }
    this._api.getNotificationManager().setNotification(
      createNotificationFromText(localize(messageKey), {
        heading: { text: localize('error.call_unavailable_heading') },
      }),
    );
  }

  // Returns `true` to proceed, `false` to abort (with a notification surfaced
  // unless `inbound` is set).
  private _microphonePreflight(inbound: boolean): boolean {
    const microphoneManager = this._api.getMicrophoneManager();

    if (!microphoneManager.isSupported()) {
      this._notifyError('error.call_microphone_unsupported', inbound);
      return false;
    }

    if (microphoneManager.isForbidden()) {
      this._notifyError('error.call_microphone_forbidden', inbound);
      return false;
    }

    return true;
  }

  private async _connectMicrophone(): Promise<boolean> {
    const microphoneManager = this._api.getMicrophoneManager();
    if (microphoneManager.isConnected()) {
      return true;
    }
    try {
      await microphoneManager.connect();
      return true;
    } catch {
      return false;
    }
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
      this._notifyError('error.call_invalid_target', inbound);
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
      this._notifyError('error.call_no_two_way_audio', inbound);
      return null;
    }
    return candidates[0];
  }
}
