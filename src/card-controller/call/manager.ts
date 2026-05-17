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

    // A call is anchored to a camera. Observe the condition state so the call
    // can be ended if the view moves off its camera.
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

  public async start(cameraID?: string): Promise<void> {
    const view = this._api.getViewManager().getView();
    if (!view?.camera) {
      return;
    }
    const parentID = view.camera;

    if (this._call?.cameraID === parentID) {
      // Already active for this camera.
      return;
    }

    const targetID = cameraID
      ? this._validateExplicitTarget(cameraID)
      : this._pickDefaultTarget(view, parentID);
    if (!targetID) {
      return;
    }

    if (!this._microphonePreflight()) {
      return;
    }

    if (!(await this._connectMicrophone())) {
      return;
    }

    // `callCameraID` is the substream carrying the call audio -- absent when
    // the call runs on the parent camera itself. `previousStream` captures any
    // override active before the call so it can be restored on end-call
    // (`getStreamCameraID` returns the parent when no override is active,
    // which is not an override to remember).
    const callCameraID = targetID === parentID ? undefined : targetID;
    const previousStream = getStreamCameraID(view, parentID);
    this._call = {
      cameraID: parentID,
      ...(callCameraID && { callCameraID }),
      ...(previousStream && previousStream !== parentID && { previousStream }),
    };

    this._api.getViewManager().setViewByParameters({
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

  // End the call if the selected camera -- or the engaged substream on that
  // camera -- has changed away from what the call is anchored to (e.g. a
  // navigation or `live_substream_*` action while `live.controls.call.lock` is
  // disabled, or a forced view change).
  private _handleConditionStateChange = (stateChange: ConditionStateChange): void => {
    if (
      this._call &&
      (stateChange.new.camera !== this._call.cameraID ||
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

  private _validateExplicitTarget(cameraID: string): string | null {
    if (!this._hasCallCapability(cameraID)) {
      this._notifyError('error.call_no_two_way_audio');
      return null;
    }
    return cameraID;
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
