import type { IssueResolveContext, IssueTriggerContext } from 'issue';

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
    media_unavailable: {
      targetID: string;
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

    // React to a target's media loading; unload / select changes are
    // irrelevant here.
    this._unsubscribeCallback = this._api
      .getMediaLoadedInfoManager()
      .subscribe((change) => {
        if (change.type === 'load') {
          this._onMediaLoad(change.targetID);
        }
      });
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

  // A target is proven to be delivering media again. Stronger evidence than a
  // media load, which only says a player attached, so it clears any recorded
  // error.
  public resolve(context: IssueResolveContext['media_unavailable']): void {
    this._erroredTargets.delete(context.targetID);
    this._cancelPendingTimer(context.targetID);
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
    // attached). Errors are cleared out-of-band, by `resolve` or by
    // `_onMediaLoad`.
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

  // A load proves media attached for the target. That ends any wait on it, and
  // refutes a `not_loading` error. It is no evidence of recovery for any other
  // reason, so those clear only via `resolve`.
  private _onMediaLoad(targetID: string): void {
    let changed = this._cancelPendingTimer(targetID);
    if (this._erroredTargets.get(targetID)?.reason === 'not_loading') {
      this._erroredTargets.delete(targetID);
      changed = true;
    }
    if (changed) {
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
    // target the pending timer is tracking (so a user-initiated retry
    // works even before the timeout fires). A stopped timer leaves
    // _timerTargetID behind, so gate on it still running: that target may
    // since have loaded.
    const retryTargets = new Set(this._erroredTargets.keys());
    if (this._timerTargetID && this._timer.isRunning()) {
      retryTargets.add(this._timerTargetID);
    }

    if (!retryTargets.size) {
      return false;
    }

    // Bumping a target's mediaEpoch remounts its provider, which is the card's
    // only way to rebuild a stream from scratch.
    const view = this._api.getViewManager().getView();
    const mediaEpoch = { ...(view?.context?.mediaEpoch ?? {}) };
    for (const id of retryTargets) {
      mediaEpoch[id] = (mediaEpoch[id] ?? 0) + 1;
    }

    // Intentionally keep _issueActive, _erroredTargets, and the pending
    // timer in place. The issue stays visible while the provider re-attempts
    // loading underneath. If the retry succeeds, the fresh load clears a
    // not-loading error and the rebuilt provider's liveness observation
    // resolves a stream error. If it fails silently (e.g. bogus stream name),
    // the error stays visible immediately -- no new 10s grace period.
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

  // Stop waiting on a target's load, if it is the one being waited on. Returns
  // whether it was.
  private _cancelPendingTimer(targetID: string): boolean {
    if (this._timerTargetID !== targetID) {
      return false;
    }
    this._timer.stop();
    this._timerTargetID = null;
    return true;
  }

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
        this.trigger({ targetID, reason: 'not_loading' });
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
