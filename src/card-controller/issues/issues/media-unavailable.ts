import type { IssueTriggerContext } from 'issue';

import type { ConditionState } from '../../../condition-trigger/conditions/types.js';
import type {
  Notification,
  NotificationDetail,
} from '../../../config/schema/actions/types.js';
import { TROUBLESHOOTING_MEDIA_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import type { UnsubscribeCallback } from '../../../types.js';
import { Timer } from '../../../utils/timer.js';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../view/target-id.js';
import { isAnyMediaViewName } from '../../../view/view.js';
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
  | 'two_way_audio_error'
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
}

// What is known about one target's failure.
interface TargetError {
  reason: MediaUnavailableIssueReason;
  description?: string;
}

const MEDIA_LOADING_TIMEOUT_SECONDS = 10;

// The per-cause presentation (localization key + icon), shared by the
// notification metadata and the reconnecting placeholder so each cause is
// described in exactly one place.
export const MEDIA_UNAVAILABLE_REASONS: Record<
  MediaUnavailableIssueReason,
  { localizationKey: string; icon: string }
> = {
  entity_unavailable: {
    localizationKey: 'issues.media_unavailable.reasons.entity_unavailable',
    icon: 'mdi:cctv-off',
  },
  not_loading: {
    localizationKey: 'issues.media_unavailable.reasons.not_loading',
    icon: 'mdi:progress-helper',
  },
  playback_error: {
    localizationKey: 'issues.media_unavailable.reasons.playback_error',
    icon: 'mdi:alert-circle',
  },
  server_error: {
    localizationKey: 'issues.media_unavailable.reasons.server_error',
    icon: 'mdi:server-network-off',
  },
  stalled: {
    localizationKey: 'issues.media_unavailable.reasons.stalled',
    icon: 'mdi:motion-pause',
  },
  two_way_audio_error: {
    localizationKey: 'issues.media_unavailable.reasons.two_way_audio_error',
    icon: 'mdi:microphone-off',
  },
  unsupported: {
    localizationKey: 'issues.media_unavailable.reasons.unsupported',
    icon: 'mdi:video-off-outline',
  },
};

export class MediaUnavailableIssue implements Issue {
  public readonly key = 'media_unavailable' as const;

  private _issueActive = false;
  private _erroredTargets = new Map<string, TargetError>();

  // Timer fires when a target has been loading too long without success.
  private _timer = new Timer();
  private _timerTargetID: string | null = null;

  private _api: CardIssueManagerAPI;
  private _onChange: (() => void) | null;
  private _unsubscribeCallback: UnsubscribeCallback;

  constructor(api: CardIssueManagerAPI, onChange?: () => void) {
    this._api = api;
    this._onChange = onChange ?? null;

    // Clear a target's error on a genuine media (re)load.
    this._unsubscribeCallback = this._api
      .getMediaLoadedInfoManager()
      .subscribe((change) => {
        // A reconnect replay (`cached`) did not actually reload the media, and
        // unload / select changes are irrelevant here; only a genuine load
        // clears the error.
        if (change.type === 'load' && !change.cached) {
          this._onMediaLoad(change.targetID);
        }
      });
  }

  // =========================================================================
  // Explicit trigger -- called when a component fires an issue:trigger event.
  // =========================================================================

  public trigger(context: IssueTriggerContext['media_unavailable']): void {
    this._erroredTargets.set(context.targetID, {
      reason: context.reason,
      description: context.description,
    });
  }

  // =========================================================================
  // Detection -- called by the manager on every state change.
  // =========================================================================

  public detectDynamic(state: ConditionState): void {
    if (!isAnyMediaViewName(state.view)) {
      this._deactivate();
      return;
    }

    // A known error for the current target activates immediately, even if its
    // (frozen) media still reads as loaded (it might be loaded but then
    // reported a playback error that stops playback but leaves the player
    // attached). Errors are cleared out-of-band by `_onMediaLoad` on a genuine
    // reload.
    if (this._hasError(state)) {
      this._activate();
      return;
    }

    if (state.mediaLoadedInfo) {
      // Loaded with no known error: healthy.
      this._deactivate();
      return;
    }

    this._handlePendingLoad(state);
  }

  // A genuine media (re)load for a target clears its error.
  private _onMediaLoad(targetID: string): void {
    if (this._erroredTargets.delete(targetID)) {
      this._onChange?.();
    }
  }

  // =========================================================================
  // State queries -- called by the manager to read current state.
  // =========================================================================

  public hasIssue(): boolean {
    return this._issueActive;
  }

  public getIssue(): IssueDescription | null {
    if (!this._issueActive) {
      return null;
    }
    return {
      icon: 'mdi:cctv-off',
      severity: 'high',
      notification: this.getNotification(),
    };
  }

  public getNotification(): Notification {
    const targets = new Map(this._erroredTargets);
    // The pending-load timer's target is a slow initial load that has not yet
    // errored. Gate on the timer still running: once it is stopped (a hard error
    // on another target took over, or the view moved on), _timerTargetID lingers
    // and would otherwise paint a stale "not loading" line for a target that has
    // since loaded.
    if (
      this._timerTargetID &&
      this._timer.isRunning() &&
      !targets.has(this._timerTargetID)
    ) {
      targets.set(this._timerTargetID, { reason: 'not_loading' });
    }

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
    return this._issueActive;
  }

  public retry(): boolean {
    // Build the set of targets to retry: all errored targets plus the
    // target the pending timer was tracking (so a user-initiated retry
    // works even before the timeout fires).
    const retryTargets = new Set(this._erroredTargets.keys());
    if (this._timerTargetID) {
      retryTargets.add(this._timerTargetID);
    }

    if (!retryTargets.size) {
      return false;
    }

    const view = this._api.getViewManager().getView();
    const mediaEpoch = { ...(view?.context?.mediaEpoch ?? {}) };
    for (const id of retryTargets) {
      mediaEpoch[id] = (mediaEpoch[id] ?? 0) + 1;
    }

    // Intentionally keep _issueActive, _erroredTargets, and the pending
    // timer in place. The issue stays visible while the provider
    // re-attempts loading underneath. If the retry succeeds, the fresh media
    // load clears everything (_onMediaLoad drops the errored target). If it
    // fails silently (e.g. bogus stream name), the error stays visible
    // immediately -- no new 10s grace period.
    this._api.getViewManager().setViewWithMergedContext({ mediaEpoch });
    return false;
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(): void {
    this._deactivate();
    this._erroredTargets.clear();
  }

  // Stop reacting to media loads at end of life.
  public destroy(): void {
    this._unsubscribeCallback();
  }

  // Stop the pending-load timer so offscreen time doesn't count toward the
  // 10s threshold. Preserve _issueActive, _erroredTargets, and
  // _timerTargetID: already-visible errors remain visible on reattach, and
  // retaining _timerTargetID lets the existing active/target-mismatch guard
  // in _handlePendingLoad avoid spuriously deactivating the preserved
  // issue when the same target is still loading on resume. The timer is
  // re-armed with a fresh window by the next detectDynamic pass.
  public suspend(): void {
    this._timer.stop();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  // Media not yet loaded and no known error: start (or keep) a timeout to catch
  // a slow or failed initial load. No targetID means no provider is rendering
  // media (e.g. the viewer shows "No media to display"), so there's nothing to
  // wait for.
  private _handlePendingLoad(state: ConditionState): void {
    if (!state.targetID) {
      this._deactivate();
      return;
    }

    const targetID = state.targetID;

    // When the target changes, clear the active state so the new target gets
    // its own timeout window instead of inheriting the previous target's.
    if (this._issueActive && this._timerTargetID !== targetID) {
      this._deactivate();
    }

    // Start (or restart) the timer for this target.
    if (!this._timer.isRunning() || this._timerTargetID !== targetID) {
      this._timerTargetID = targetID;
      this._timer.start(MEDIA_LOADING_TIMEOUT_SECONDS, () => {
        // Record the error on timeout so retry() knows which epoch to bump.
        this._erroredTargets.set(targetID, { reason: 'not_loading' });
        this._activate();
        this._onChange?.();
      });
    }
  }

  private _hasError(state: ConditionState): boolean {
    return !!state.targetID && this._erroredTargets.has(state.targetID);
  }

  private _activate(): void {
    this._timer.stop();
    this._issueActive = true;
  }

  private _deactivate(): void {
    this._timer.stop();
    this._timerTargetID = null;
    this._issueActive = false;
  }
}
