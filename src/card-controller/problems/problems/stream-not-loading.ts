import { Notification } from '../../../config/schema/actions/types.js';
import { TROUBLESHOOTING_STREAM_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import { Timer } from '../../../utils/timer.js';
import {
  Problem,
  ProblemDynamicContext,
  ProblemResult,
  ProblemTriggerContext,
} from '../types.js';

const STREAM_LOADING_TIMEOUT_SECONDS = 10;

export class StreamNotLoadingProblem implements Problem {
  public readonly key = 'stream_not_loading' as const;

  private _problemActive = false;
  private _cameraIDsWithErrors = new Set<string>();
  private _timer = new Timer();
  private _timerCameraID: string | null = null;
  private _triggerUpdate: () => void;

  constructor(triggerUpdate: () => void) {
    this._triggerUpdate = triggerUpdate;
  }

  public trigger(context?: ProblemTriggerContext): void {
    if (context?.cameraID) {
      this._cameraIDsWithErrors.add(context.cameraID);
    }
  }

  public detectDynamic(context: ProblemDynamicContext): void {
    if (context.view !== 'live') {
      this._deactivate();
      return;
    }

    if (context.mediaLoaded) {
      this._handleStreamLoaded(context.cameraID);
    } else {
      this._handleStreamNotLoaded(context.cameraID);
    }
  }

  // Stream loaded successfully. Deactivate and clear any prior provider error
  // for this camera so it won't re-trigger on the next evaluation.
  private _handleStreamLoaded(cameraID?: string): void {
    this._deactivate();
    if (cameraID) {
      this._cameraIDsWithErrors.delete(cameraID);
    }
  }

  // Stream not yet loaded. Activate immediately if this camera has a known
  // provider error, otherwise start a timeout to detect slow loads.
  private _handleStreamNotLoaded(cameraID?: string): void {
    if (this._hasCameraError(cameraID)) {
      this._activate();
    } else if (!this._problemActive) {
      // Restart the timer when the selected camera changes so each camera
      // gets its own timeout window.
      if (!this._timer.isRunning() || this._timerCameraID !== (cameraID ?? null)) {
        this._timerCameraID = cameraID ?? null;
        this._timer.start(STREAM_LOADING_TIMEOUT_SECONDS, () => {
          this._activate();
          this._triggerUpdate();
        });
      }
    }
  }

  public hasResult(): boolean {
    return this._problemActive;
  }

  public getNotification(): Notification {
    return {
      heading: {
        text: localize('problems.stream_not_loading.heading'),
        icon: 'mdi:cctv-off',
        severity: 'high',
      },
      text: localize('problems.stream_not_loading.text'),
      link: {
        url: TROUBLESHOOTING_STREAM_URL,
        title: localize('problems.troubleshooting_guide'),
      },
    };
  }

  public getResult(): ProblemResult | null {
    if (!this._problemActive) {
      return null;
    }
    return {
      icon: 'mdi:cctv-off',
      severity: 'high',
      notification: this.getNotification(),
    };
  }

  public destroy(): void {
    this._deactivate();
    this._cameraIDsWithErrors.clear();
  }

  private _activate(): void {
    this._timer.stop();
    this._problemActive = true;
  }

  private _deactivate(): void {
    this._timer.stop();
    this._timerCameraID = null;
    this._problemActive = false;
  }

  private _hasCameraError(camera?: string): boolean {
    return !!camera && this._cameraIDsWithErrors.has(camera);
  }
}
