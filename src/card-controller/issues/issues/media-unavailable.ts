import { add } from 'date-fns';
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

  // The earliest the card should rebuild this target's media. Carried forward
  // across repeat reports of the same failure, and refreshed when a rebuild
  // starts a new attempt.
  rebuildNotBefore: Date;
}

// The per-cause presentation (localization key + icon) and handling, shared by
// the notification metadata and the reconnecting placeholder so each cause is
// described in exactly one place. `resetOnLoad` means a media load will reset
// this issue reason. `rebuildGraceSeconds` is how long the media is left alone
// before the card rebuilds it: media that has failed has nothing to protect and
// is rebuilt at once, so only a load still in progress asks for any.
export const MEDIA_UNAVAILABLE_REASONS: Record<
  MediaUnavailableIssueReason,
  {
    localizationKey: string;
    icon: string;
    resetOnLoad: boolean;
    rebuildGraceSeconds: number;
  }
> = {
  entity_unavailable: {
    localizationKey: 'issues.media_unavailable.reasons.entity_unavailable',
    icon: 'mdi:cctv-off',
    resetOnLoad: false,
    rebuildGraceSeconds: 0,
  },
  not_loading: {
    localizationKey: 'issues.media_unavailable.reasons.not_loading',
    icon: 'mdi:progress-helper',
    resetOnLoad: true,
    // A load that has not arrived yet has not necessarily failed: the provider is
    // mounted and still trying, so rebuilding it destroys an attempt that may be
    // about to succeed. Hold a rebuild off for at least this long, three load
    // windows, to give that attempt time to finish.
    rebuildGraceSeconds: 30,
  },
  playback_error: {
    localizationKey: 'issues.media_unavailable.reasons.playback_error',
    icon: 'mdi:alert-circle',

    // A player can load media and still fail to play it.
    resetOnLoad: false,
    rebuildGraceSeconds: 0,
  },
  server_error: {
    localizationKey: 'issues.media_unavailable.reasons.server_error',
    icon: 'mdi:server-network-off',
    resetOnLoad: true,
    rebuildGraceSeconds: 0,
  },
  stalled: {
    localizationKey: 'issues.media_unavailable.reasons.stalled',
    icon: 'mdi:motion-pause',
    resetOnLoad: false,
    rebuildGraceSeconds: 0,
  },
  unsupported: {
    localizationKey: 'issues.media_unavailable.reasons.unsupported',
    icon: 'mdi:video-off-outline',

    // Substitute pictures are never announced as loaded media, so a load means
    // the requested media was delivered in some supported way after all.
    resetOnLoad: true,
    rebuildGraceSeconds: 0,
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
    // A target already failing this same way keeps the deadline it was given,
    // so repeat reports of one failure cannot push a rebuild out indefinitely.
    const existing = this._erroredTargets.get(context.targetID);
    this._erroredTargets.set(context.targetID, {
      reason: context.reason,
      description: context.description,
      rebuildNotBefore:
        existing?.reason === context.reason
          ? existing.rebuildNotBefore
          : this._getRebuildDeadline(context.reason),
    });
  }

  private _getRebuildDeadline(reason: MediaUnavailableIssueReason): Date {
    return add(new Date(), {
      seconds: MEDIA_UNAVAILABLE_REASONS[reason].rebuildGraceSeconds,
    });
  }

  // Whether this target's media has waited long enough to be rebuilt.
  private _isRebuildDue(error: TargetError): boolean {
    return new Date() >= error.rebuildNotBefore;
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

  // False while everything on screen is still within its grace period, so the
  // manager treats the moment as one where nothing was attempted rather than as
  // a failed attempt that should lengthen the wait for the next one.
  public canRetryNow(): boolean {
    return [...this._getDisplayedErrors().values()].some((error) =>
      this._isRebuildDue(error),
    );
  }

  public retry(force?: boolean): boolean {
    const retryTargets = new Map(
      [...this._getDisplayedErrors()].filter(
        ([, error]) => force || this._isRebuildDue(error),
      ),
    );
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

    for (const error of retryTargets.values()) {
      error.rebuildNotBefore = this._getRebuildDeadline(error.reason);
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
