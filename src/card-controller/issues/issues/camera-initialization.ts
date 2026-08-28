import type { IssueResolveContext, IssueTriggerContext } from 'issue';

import type {
  Notification,
  NotificationDetail,
} from '../../../config/schema/actions/types.js';
import { TROUBLESHOOTING_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import type { Severity } from '../../../severity.js';
import type { CardIssueManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import type { Issue, IssueDescription } from '../types.js';

// How much of a camera could not be initialized: a failed camera serves nothing
// at all, a degraded one serves media but offers less.
export type CameraInitializationState = 'failed' | 'degraded';

declare module 'issue' {
  interface IssueTriggerContext {
    camera_initialization: {
      cameraID: string;
      state: CameraInitializationState;

      // What went wrong, when the camera failed outright.
      error?: unknown;
    };
  }

  interface IssueResolveContext {
    camera_initialization: { cameraID: string };
  }
}

interface CameraInitialization {
  state: CameraInitializationState;
  error?: unknown;

  retrying: boolean;
}

const CAMERA_INITIALIZATION_STATES: Record<
  CameraInitializationState,
  { localizationKey: string; icon: string; severity: Severity }
> = {
  failed: {
    localizationKey: 'issues.camera_initialization.states.failed',
    icon: 'mdi:camera-off',
    severity: 'high',
  },
  degraded: {
    localizationKey: 'issues.camera_initialization.states.degraded',
    icon: 'mdi:progress-helper',
    severity: 'medium',
  },
};

export class CameraInitializationIssue implements Issue {
  public readonly key = 'camera_initialization' as const;

  private _cameras = new Map<string, CameraInitialization>();
  private _api: CardIssueManagerAPI;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  // =========================================================================
  // Explicit trigger and resolve
  // =========================================================================

  public trigger(context: IssueTriggerContext['camera_initialization']): void {
    this._cameras.set(context.cameraID, {
      state: context.state,
      error: context.error,
      retrying: false,
    });
  }

  public resolve(context: IssueResolveContext['camera_initialization']): void {
    this._cameras.delete(context.cameraID);
  }

  // =========================================================================
  // State queries
  // =========================================================================

  public hasIssue(): boolean {
    return !!this._cameras.size;
  }

  public getIssue(): IssueDescription | null {
    if (!this.hasIssue()) {
      return null;
    }

    const state = CAMERA_INITIALIZATION_STATES[this._getDominantState()];
    return {
      icon: state.icon,
      severity: state.severity,
      notification: this.getNotification(),
    };
  }

  public getNotification(): Notification {
    const state = CAMERA_INITIALIZATION_STATES[this._getDominantState()];

    // The error messages go in the context block rather than on the per-camera
    // lines, which stay short enough to scan when several cameras fail at once.
    const context = [...this._cameras].flatMap(([cameraID, initialization]) =>
      initialization.error instanceof Error
        ? [`${this._getCameraName(cameraID)}: ${initialization.error.message}`]
        : [],
    );

    return {
      heading: {
        text: localize('issues.camera_initialization.heading'),
        icon: state.icon,
        severity: state.severity,
      },
      body: {
        text: localize('issues.camera_initialization.text'),
      },
      ...(this._cameras.size && {
        metadata: [...this._cameras].map(([cameraID, initialization]) =>
          this._getCameraDetail(cameraID, initialization.state),
        ),
      }),
      ...(context.length && { context }),
      link: {
        url: TROUBLESHOOTING_URL,
        title: localize('issues.troubleshooting_guide'),
      },
      controls: [createRetryControl(this.key)],
    };
  }

  // =========================================================================
  // Retry
  // =========================================================================

  public needsRetry(): boolean {
    return this.hasIssue();
  }

  public canRetryNow(): boolean {
    return [...this._cameras.values()].some(
      (initialization) => !initialization.retrying,
    );
  }

  public retry(): boolean {
    for (const [cameraID, initialization] of this._cameras) {
      if (initialization.retrying) {
        continue;
      }
      initialization.retrying = true;

      this._api
        .getCameraManager()
        .reinitializeCamera(cameraID)
        // Not awaited: the camera manager reports the outcome by triggering or
        // resolving this issue for the camera.
        .catch(() => {});
    }

    // Allow other unrelated issues to retry in parallel.
    return false;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  public reset(): void {
    this._cameras.clear();
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  // The most serious state any camera is in: a camera serving nothing outranks
  // one that is merely degraded.
  private _getDominantState(): CameraInitializationState {
    return [...this._cameras.values()].some(
      (initialization) => initialization.state === 'failed',
    )
      ? 'failed'
      : 'degraded';
  }

  private _getCameraDetail(
    cameraID: string,
    state: CameraInitializationState,
  ): NotificationDetail {
    const entry = CAMERA_INITIALIZATION_STATES[state];
    return {
      icon: entry.icon,
      text: `${this._getCameraName(cameraID)}: ${localize(entry.localizationKey)}`,
    };
  }

  private _getCameraName(cameraID: string): string {
    return this._api.getCameraManager().getCameraMetadata(cameraID)?.title ?? cameraID;
  }
}
