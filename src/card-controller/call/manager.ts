import { cloneDeep } from 'lodash-es';
import { createNotificationFromText } from '../../components-lib/notification/factory';
import { ConditionStateChange } from '../../conditions/types';
import { localize } from '../../localize/localize';
import { getStreamCameraID } from '../../view/substream';
import { View } from '../../view/view';
import { CardCallAPI } from '../types';
import { SubstreamViewModifier } from '../view/modifiers/substream';
import { CallSession } from './types';

export class CallManager {
  private _api: CardCallAPI;
  private _call: CallSession | null = null;

  constructor(api: CardCallAPI) {
    this._api = api;

    // A call runs on the live view of a specific camera. Observe the
    // condition state so the call can be ended if the view, camera or engaged
    // substream moves off what the call started on.
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

  public async start(cameraID?: string, streamID?: string): Promise<void> {
    const view = this._api.getViewManager().getView();

    const parentID = cameraID ?? view?.camera;
    if (!view || !parentID) {
      return;
    }

    if (
      !this._api
        .getCameraManager()
        .getStore()
        .getCameraIDsWithCapability('live')
        .has(parentID)
    ) {
      this._notifyError('error.call_invalid_target');
      return;
    }

    const targetID = streamID
      ? this._validateStream(parentID, streamID)
      : this._pickDefaultTarget(view, parentID);
    if (!targetID) {
      return;
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
      // This exact call (same parent camera and stream) is already running; a
      // repeat request must not disrupt it.
      return;
    }

    if (!this._microphonePreflight()) {
      return;
    }

    if (!(await this._connectMicrophone())) {
      return;
    }

    // Store the previous view so it can be restored later. A call superseding
    // another inherits the earlier call's previous view -- the user never left
    // the call. `queryResults` are dropped (re-fetched fresh on restore);
    // `context` is deep-cloned so the call engaging its own substream below
    // cannot mutate the snapshot.
    const previousView = existingCall
      ? existingCall.previousView
      : view.evolve({ queryResults: null, context: cloneDeep(view.context) });

    const needsNavigation = !view.is('live') || view.camera !== parentID;

    // Any other call in progress is superseded. Ended here -- after the
    // preflight passes -- so a failed preflight leaves the existing call
    // intact.
    if (existingCall) {
      this._end(false);
    }

    this._call = {
      cameraID: parentID,
      ...(callCameraID && { callCameraID }),
      previousView,
    };

    this._api.getViewManager().setViewByParameters({
      ...(needsNavigation && {
        params: { view: 'live', camera: parentID },
      }),
      modifiers: [new SubstreamViewModifier(callCameraID, parentID)],
      force: true,
    });
    this._api.getConditionStateManager().setState({ call: true });
  }

  // Ends the call and returns to the view that was showing before
  // `call_start` -- the user-facing `call_end`.
  public end(): void {
    this._end(true);
  }

  // `restoreView` navigates back to the pre-call view -- the symmetric
  // counterpart of `call_start`'s navigation -- for an explicit `call_end`. It
  // is `false` for auto-ends (navigating away, camera/substream change), where
  // the user has already chosen a destination and the pre-call view is
  // deliberately not reinstated; only the manager's own auto-end paths pass it.
  private _end(restoreView: boolean): void {
    if (!this._call) {
      return;
    }
    const call = this._call;
    const previousView = call.previousView;

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
          new SubstreamViewModifier(
            previousStream && previousStream !== call.cameraID
              ? previousStream
              : undefined,
            call.cameraID,
          ),
        ],
        force: true,
      });
    }
    this._api.getConditionStateManager().setState({ call: false });
  }

  // End the call once it can no longer be conducted from where it started: the
  // view leaves `live` (the call overlay exists only there, so the call would
  // otherwise be stranded with no controls), the selected camera changes, or
  // the engaged substream moves off the call's audio source. Covers navigation
  // and `live_substream_*` actions taken while `live.controls.call.lock` is
  // disabled, as well as any forced view change.
  private _handleConditionStateChange = (stateChange: ConditionStateChange): void => {
    if (
      this._call &&
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

  private _notifyError(messageKey: string): void {
    this._api.getNotificationManager().setNotification(
      createNotificationFromText(localize(messageKey), {
        heading: { text: localize('error.call_unavailable_heading') },
      }),
    );
  }

  // Returns `true` to proceed, `false` to abort (with a notification already
  // surfaced).
  private _microphonePreflight(): boolean {
    const microphoneManager = this._api.getMicrophoneManager();

    if (!microphoneManager.isSupported()) {
      this._notifyError('error.call_microphone_unsupported');
      return false;
    }

    if (microphoneManager.isForbidden()) {
      this._notifyError('error.call_microphone_forbidden');
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
      this._notifyError('error.call_microphone_forbidden');
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
  private _validateStream(cameraID: string, streamID: string): string | null {
    const eligibleCameraIDs = this._api
      .getCameraManager()
      .getStore()
      .getAllDependentCameras(cameraID, '2-way-audio');
    if (!eligibleCameraIDs.has(streamID)) {
      this._notifyError('error.call_invalid_target');
      return null;
    }
    return streamID;
  }

  // Pick the default call target. Prefer the currently-engaged stream when
  // it's call-capable (keeps the user's substream selection intact). Else
  // fall back to the parent itself (if call-capable) or the first eligible
  // dependency. Returns null + notification if neither path finds a target.
  private _pickDefaultTarget(view: View, parentID: string): string | null {
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
      this._notifyError('error.call_no_two_way_audio');
      return null;
    }
    return candidates[0];
  }
}
