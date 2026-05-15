import { MicrophoneManager } from '../../card-controller/microphone-manager.js';
import {
  MicrophoneAutoMuteCondition,
  MicrophoneAutoUnmuteCondition,
} from '../../config/schema/common/media-actions.js';
import { EdgeDetector } from '../../utils/edge-detector.js';
import { VisibilityObserver } from '../visibility-observer.js';

interface MicrophoneActionsControllerOptions {
  microphoneManager?: MicrophoneManager;
  autoMuteConditions?: readonly MicrophoneAutoMuteCondition[];
  autoUnmuteConditions?: readonly MicrophoneAutoUnmuteCondition[];
}

/**
 * Owns microphone auto-mute/unmute rules at the live-view level.
 *
 * The microphone is a global singleton so cannot be controlled by
 * MediaActionsController without clashes between different controllers for
 * different cameras. This gives:
 *  - deterministic ordering on selection change (this single owner sequences
 *    'unselected' for the leaver and 'selected' for the arriver),
 *  - a single intersection observer scoped to the live root (correct
 *    'visible'/'hidden' semantics for the whole live view, not per-cell), and
 *  - a single document.visibilitychange listener.
 */
export class MicrophoneActionsController {
  private _options: MicrophoneActionsControllerOptions | null = null;
  private _selectedCamera: string | null = null;
  private _callEdge = new EdgeDetector();
  private _visibilityObserver: VisibilityObserver;

  constructor() {
    this._visibilityObserver = new VisibilityObserver((visible) =>
      this._changeVisibility(visible),
    );
  }

  public setOptions(options: MicrophoneActionsControllerOptions): void {
    this._options = options;
  }

  /**
   * Notifies the controller of the current call-active state. Acts only on a
   * genuine transition (see `EdgeDetector`): on call start, unmuting is a
   * no-op by default (microphone.auto_unmute is empty — push-to-talk) and
   * fires only if the user opted into `['call']`; on call end, the microphone
   * is muted by default (cleanup).
   */
  public setCallActive(active: boolean): void {
    switch (this._callEdge.update(active)) {
      case 'rising':
        this._unmuteIfConfigured('call');
        break;
      case 'falling':
        this._muteIfConfigured('call');
        break;
    }
  }

  public setRoot(root: HTMLElement): void {
    this._visibilityObserver.setRoot(root);
  }

  public destroy(): void {
    this._selectedCamera = null;
    this._visibilityObserver.destroy();
  }

  /**
   * Notifies the controller of the currently selected camera. Called from the
   * live root whenever view.camera changes. Fires 'unselected' for the previous
   * camera (if any) and 'selected' for the new camera (if any), in that order.
   */
  public async setSelectedCamera(camera: string | null): Promise<void> {
    if (this._selectedCamera === camera) {
      return;
    }
    const previous = this._selectedCamera;
    this._selectedCamera = camera;

    if (previous !== null) {
      this._muteIfConfigured('unselected');
    }
    if (camera !== null) {
      await this._unmuteIfConfigured('selected');
    }
  }

  private _changeVisibility = async (visible: boolean): Promise<void> => {
    if (visible) {
      await this._unmuteIfConfigured('visible');
    } else {
      this._muteIfConfigured('hidden');
    }
  };

  private async _unmuteIfConfigured(
    condition: MicrophoneAutoUnmuteCondition,
  ): Promise<void> {
    if (
      this._options?.microphoneManager &&
      this._options.autoUnmuteConditions?.includes(condition)
    ) {
      await this._options.microphoneManager.unmute();
    }
  }

  private _muteIfConfigured(condition: MicrophoneAutoMuteCondition): void {
    if (
      this._options?.microphoneManager &&
      this._options.autoMuteConditions?.includes(condition)
    ) {
      this._options.microphoneManager.mute();
    }
  }
}
