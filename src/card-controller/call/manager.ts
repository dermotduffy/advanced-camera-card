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

    // A call is anchored to the live view of a specific camera. Observe the
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
      // This exact call (same anchor and stream) is already running; a repeat
      // request must not disrupt it.
      return;
    }

    if (!this._microphonePreflight()) {
      return;
    }

    if (!(await this._connectMicrophone())) {
      return;
    }

    // `previousStream` is the substream to restore when this call ends. When
    // superseding a call already on this parentID, use that call's own
    // `previousStream` -- the stream the view currently shows is the one it
    // engaged, not the pre-call one. Otherwise the parentID is not itself on a
    // call, so its currently-engaged stream is the genuine pre-call stream.
    // `getStreamCameraID` returns the parentID itself when no substream is
    // engaged, which the assignment below drops -- there is nothing to restore.
    const previousStream =
      existingCall && existingCall.cameraID === parentID
        ? existingCall.previousStream
        : getStreamCameraID(view, parentID);

    // Any other call in progress is superseded. Ended here -- after the
    // preflight passes -- so a failed preflight leaves the existing call
    // intact.
    if (existingCall) {
      this.end();
    }

    this._call = {
      cameraID: parentID,
      ...(callCameraID && { callCameraID }),
      ...(previousStream && previousStream !== parentID && { previousStream }),
    };

    this._api.getViewManager().setViewByParameters({
      ...((!view.is('live') || view.camera !== parentID) && {
        params: { view: 'live', camera: parentID },
      }),
      modifiers: [new SubstreamViewModifier(callCameraID, parentID)],
      force: true,
    });
    this._api.getConditionStateManager().setState({ call: true });
  }

  public end(): void {
    if (!this._call) {
      return;
    }
    const call = this._call;

    // Clear the session first: ending the call dispatches a view change, and
    // the resulting condition-state change must not see this (now-ending) call
    // and recurse.
    this._call = null;

    this._api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamViewModifier(call.previousStream, call.cameraID)],
      force: true,
    });
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
      this.end();
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
