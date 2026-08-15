import type { CallSession } from '../../card-controller/call/types.js';
import type { MicrophoneManager } from '../../card-controller/microphone-manager.js';
import type {
  MicrophoneAutoMuteCondition,
  MicrophoneAutoUnmuteCondition,
} from '../../config/schema/common/media-actions.js';
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
 *  - a single intersection observer scoped to the live root (correct
 *    'visible'/'hidden' semantics for the whole live view, not per-cell), and
 *  - a single document.visibilitychange listener.
 */
export class MicrophoneActionsController {
  private _options: MicrophoneActionsControllerOptions | null = null;
  private _answeredCall: CallSession | null = null;
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
   * Notifies the controller of the active call session (outbound calls are
   * answered at start; inbound calls only become answered when the user
   * accepts). A session that is still ringing unmutes nothing, so the user is
   * never heard before accepting.
   *
   * Each session is a distinct object, so a call that replaces another is
   * acted on in its own right: the microphone connection carries over, but the
   * user is muted or unmuted by the new call's own rules rather than
   * inheriting where the previous call left them.
   *
   * An answered session unmutes the microphone only if the user opted into
   * `microphone.auto_unmute: ['call']`. There is no symmetric mute: the
   * microphone manager mutes and releases the microphone itself when the call
   * ends.
   */
  public async setCall(call?: CallSession): Promise<void> {
    const answeredCall = call?.answered ? call : null;
    if (answeredCall === this._answeredCall) {
      return;
    }
    this._answeredCall = answeredCall;
    if (answeredCall) {
      await this._unmuteIfConfigured('call');
    }
  }

  public setRoot(root: HTMLElement): void {
    this._visibilityObserver.setRoot(root);
  }

  public destroy(): void {
    this._visibilityObserver.destroy();
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
      // A denied or missing microphone already shows in the UI: the menu
      // microphone button switches to its forbidden icon. A failed auto-unmute
      // has nothing more to act on.
      await this._options.microphoneManager.unmute().catch(() => {});
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
