import {
  CallClearViewModifier,
  CallSetViewModifier,
  CallViewContext,
  isCallActive,
} from '../components-lib/live/call';
import { getStreamCameraID } from '../components-lib/live/substream';
import { createNotificationFromText } from '../components-lib/notification/factory';
import { localize } from '../localize/localize';
import { View } from '../view/view';
import { CardCallAPI } from './types';

export class CallManager {
  private _api: CardCallAPI;

  constructor(api: CardCallAPI) {
    this._api = api;
  }

  // =========================================================================
  // Readers
  // =========================================================================

  public isActive(view: View | null): boolean {
    return isCallActive(view);
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

    if (view.context?.call?.cameraID === parentID) {
      // Already active for this parent.
      return;
    }

    const target = cameraID
      ? this._validateExplicitTarget(cameraID)
      : this._pickDefaultTarget(view, parentID);
    if (!target) {
      return;
    }

    if (!this._microphonePreflight()) {
      return;
    }

    if (!(await this._connectMicrophone())) {
      return;
    }

    this._api.getViewManager().setViewByParameters({
      modifiers: [
        new CallSetViewModifier(this._buildCallViewContext(view, parentID, target)),
      ],
      force: true,
    });
    this._api.getConditionStateManager().setState({ call: true });
  }

  public end(): void {
    const view = this._api.getViewManager().getView();
    if (!this.isActive(view)) {
      return;
    }

    this._api.getViewManager().setViewByParameters({
      modifiers: [new CallClearViewModifier()],
      force: true,
    });

    this._api.getConditionStateManager().setState({ call: false });
  }

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

  private _buildCallViewContext(
    view: View,
    parentID: string,
    target: string,
  ): CallViewContext {
    const currentStream = getStreamCameraID(view, parentID);
    return {
      cameraID: parentID,
      callCameraID: target,
      // Capture any pre-call substream override so it can be restored on
      // end-call. `getStreamCameraID` returns the parent when no override is
      // active, which is not an override to remember.
      ...(currentStream &&
        currentStream !== parentID && { preCallSubstream: currentStream }),
    };
  }
}
