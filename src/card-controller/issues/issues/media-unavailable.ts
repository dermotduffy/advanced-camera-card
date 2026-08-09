import type { IssueResolveContext, IssueTriggerContext } from 'issue';

import type {
  Notification,
  NotificationDetail,
} from '../../../config/schema/actions/types.js';
import { TROUBLESHOOTING_MEDIA_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import { getDisplayedTargetIDs } from '../../../view/layout.js';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../view/target-id.js';
import type { CardIssueManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import type { Issue, IssueDescription } from '../types.js';

// Why the media_unavailable issue fired, so the notification and the reconnecting
// placeholder can explain the specific cause rather than a generic message.
export type MediaUnavailableIssueReason =
  | 'entity_unavailable'
  | 'not_loading'
  | 'playback_error'
  | 'server_error'
  | 'stalled'
  | 'unsupported';

declare module 'issue' {
  interface IssueTriggerContext {
    media_unavailable: {
      targetID: string;
      reason: MediaUnavailableIssueReason;

      // Free text naming the specific failure (e.g. the message a player
      // reported), when the trigger source knew it.
      description?: string;
    };
  }

  interface IssueResolveContext {
    // Either a resolve scoped to (at most) one named kind of failure, or the
    // statement that the target's media has loaded, which resolves whichever
    // failures have `resetOnLoad`. Only real media is ever announced as loaded:
    // the card's substitute pictures (a loading or stock image) are not, so
    // they can never make this statement.
    media_unavailable: { targetID: string } & (
      | {
          // Optionally limits the clearing to one kind of failure.
          reason?: MediaUnavailableIssueReason;
          cause?: never;
        }
      | {
          reason?: never;
          cause: 'media-loaded';
        }
    );
  }
}

// What is known about one target's failure.
interface TargetError {
  reason: MediaUnavailableIssueReason;
  description?: string;
}

// The per-cause presentation (localization key + icon), shared by the
// notification metadata and the reconnecting placeholder so each cause is
// described in exactly one place. `resetOnLoad` means a media load will reset
// this issue reason.
export const MEDIA_UNAVAILABLE_REASONS: Record<
  MediaUnavailableIssueReason,
  { localizationKey: string; icon: string; resetOnLoad: boolean }
> = {
  entity_unavailable: {
    localizationKey: 'issues.media_unavailable.reasons.entity_unavailable',
    icon: 'mdi:cctv-off',
    resetOnLoad: false,
  },
  not_loading: {
    localizationKey: 'issues.media_unavailable.reasons.not_loading',
    icon: 'mdi:progress-helper',
    resetOnLoad: true,
  },
  playback_error: {
    localizationKey: 'issues.media_unavailable.reasons.playback_error',
    icon: 'mdi:alert-circle',

    // A player can load media and still fail to play it.
    resetOnLoad: false,
  },
  server_error: {
    localizationKey: 'issues.media_unavailable.reasons.server_error',
    icon: 'mdi:server-network-off',
    resetOnLoad: true,
  },
  stalled: {
    localizationKey: 'issues.media_unavailable.reasons.stalled',
    icon: 'mdi:motion-pause',
    resetOnLoad: false,
  },
  unsupported: {
    localizationKey: 'issues.media_unavailable.reasons.unsupported',
    icon: 'mdi:video-off-outline',

    // Substitute pictures are never announced as loaded media, so a load means
    // the requested media was delivered in some supported way after all.
    resetOnLoad: true,
  },
};

// Reports media failures for the targets the user can currently see. Failures
// are raised and cleared by the components observing the media (e.g. providers)
// -- player errors and stalls via the liveness detectors, and a load that never
// arrives via each media host's load watchdog. This issue scopes them to the
// displayed targets and drives the throttled reload that retries them.
export class MediaUnavailableIssue implements Issue {
  public readonly key = 'media_unavailable' as const;

  private _erroredTargets = new Map<string, TargetError>();

  private _api: CardIssueManagerAPI;

  constructor(api: CardIssueManagerAPI) {
    this._api = api;
  }

  // =========================================================================
  // Explicit trigger and resolve -- called when a component fires an
  // issue:trigger or issue:resolve event.
  // =========================================================================

  public trigger(context: IssueTriggerContext['media_unavailable']): void {
    this._erroredTargets.set(context.targetID, {
      reason: context.reason,
      description: context.description,
    });
  }

  public resolve(context: IssueResolveContext['media_unavailable']): void {
    const error = this._erroredTargets.get(context.targetID);
    if (!error) {
      return;
    }

    if (context.cause === 'media-loaded') {
      if (!MEDIA_UNAVAILABLE_REASONS[error.reason].resetOnLoad) {
        return;
      }
    } else if (context.reason && context.reason !== error.reason) {
      return;
    }

    this._erroredTargets.delete(context.targetID);
  }

  // =========================================================================
  // State queries -- called by the manager to read current state.
  // =========================================================================

  // Reported exactly when a target on screen has a known failure, even if its
  // (frozen) media still reads as loaded (it might be loaded but then reported
  // a playback error that stops playback but leaves the player attached).
  // Failures are cleared out-of-band, by `resolve`.
  public hasIssue(): boolean {
    return !!this._getDisplayedErrors().size;
  }

  public getIssue(): IssueDescription | null {
    if (!this.hasIssue()) {
      return null;
    }
    return {
      icon: 'mdi:cctv-off',
      severity: 'high',
      notification: this.getNotification(),
    };
  }

  public getNotification(): Notification {
    const targets = this._getDisplayedErrors();

    // The free-text causes go in the context block rather than on the metadata
    // lines, which stay short enough to scan when several cameras fail at once.
    const context = Array.from(targets)
      .filter(([, error]) => error.description)
      .map(([id, error]) => `${this._getTargetName(id)}: ${error.description}`);

    return {
      heading: {
        text: localize('issues.media_unavailable.heading'),
        icon: 'mdi:cctv-off',
        severity: 'high' as const,
      },
      body: {
        text: localize('issues.media_unavailable.text'),
      },
      ...(targets.size && {
        metadata: Array.from(targets).map(([id, error]) =>
          this._getTargetDetail(id, error.reason),
        ),
      }),
      ...(context.length && { context }),
      link: {
        url: TROUBLESHOOTING_MEDIA_URL,
        title: localize('issues.troubleshooting_guide'),
      },
      controls: [createRetryControl(this.key)],
    };
  }

  // A per-camera notification detail: the target's name and its specific cause
  // (e.g. "Office: Stream stalled"), with that cause's icon.
  private _getTargetDetail(
    id: string,
    reason: MediaUnavailableIssueReason,
  ): NotificationDetail {
    const isImage = id === IMAGE_VIEW_TARGET_ID_SENTINEL;
    return {
      text: `${this._getTargetName(id)}: ${localize(
        MEDIA_UNAVAILABLE_REASONS[reason].localizationKey,
      )}`,
      icon: isImage ? 'mdi:image' : MEDIA_UNAVAILABLE_REASONS[reason].icon,
    };
  }

  // The user-facing name of a target: a camera's title, or the label for the
  // image view (which may have no camera behind it).
  private _getTargetName(id: string): string {
    return id === IMAGE_VIEW_TARGET_ID_SENTINEL
      ? localize('editor.image')
      : this._api.getCameraManager().getCameraMetadata(id)?.title ?? id;
  }

  // =========================================================================
  // Retry -- called by the manager to schedule a media reload.
  // =========================================================================

  public needsRetry(): boolean {
    return this.hasIssue();
  }

  public retry(): boolean {
    const retryTargets = this._getDisplayedErrors();
    if (!retryTargets.size) {
      return false;
    }

    // Bumping a target's mediaEpoch remounts its provider, which is the card's
    // only way to rebuild a stream from scratch.
    const view = this._api.getViewManager().getView();
    const mediaEpoch = { ...(view?.context?.mediaEpoch ?? {}) };
    for (const id of retryTargets.keys()) {
      mediaEpoch[id] = (mediaEpoch[id] ?? 0) + 1;
    }

    // Intentionally keep _erroredTargets in place. The issue stays visible
    // while the provider re-attempts loading underneath. If the retry succeeds,
    // the fresh load clears a not-loading error and the rebuilt provider's
    // liveness observation resolves a stream error. If it fails silently (e.g.
    // bogus stream name), the error stays visible immediately.
    this._api.getViewManager().setViewWithMergedContext({ mediaEpoch });
    return false;
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(): void {
    this._erroredTargets.clear();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  // The errored targets the user can currently see. An error recorded for a
  // target that has since left the screen names something they cannot look at,
  // and reloading it would achieve nothing. Read fresh rather than remembered:
  // a change in conditions can re-evaluate an override that replaces the
  // configured cameras, leaving the view exactly as it was.
  private _getDisplayedErrors(): Map<string, TargetError> {
    const view = this._api.getViewManager().getView();
    if (!view) {
      return new Map();
    }

    const displayedTargetIDs = getDisplayedTargetIDs(view, this._api.getCameraManager());
    return new Map(
      [...this._erroredTargets].filter(([targetID]) => displayedTargetIDs.has(targetID)),
    );
  }
}
