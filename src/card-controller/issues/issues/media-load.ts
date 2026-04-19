import type { IssueTriggerContext } from 'issue';
import { ConditionState } from '../../../conditions/types.js';
import { Notification } from '../../../config/schema/actions/types.js';
import { TROUBLESHOOTING_MEDIA_URL } from '../../../const.js';
import { localize } from '../../../localize/localize.js';
import { Timer } from '../../../utils/timer.js';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../view/target-id.js';
import { isAnyMediaViewName } from '../../../view/view.js';
import { CardIssueManagerAPI } from '../../types.js';
import { createRetryControl } from '../retry-control.js';
import { Issue, IssueDescription } from '../types.js';

declare module 'issue' {
  interface IssueTriggerContext {
    media_load: { targetID: string };
  }
}

const MEDIA_LOADING_TIMEOUT_SECONDS = 10;

export class MediaLoadIssue implements Issue {
  public readonly key = 'media_load' as const;

  private _issueActive = false;
  private _erroredTargetIDs = new Set<string>();

  // Timer fires when a target has been loading too long without success.
  private _timer = new Timer();
  private _timerTargetID: string | null = null;

  private _api: CardIssueManagerAPI;
  private _onChange: (() => void) | null;

  constructor(api: CardIssueManagerAPI, onChange?: () => void) {
    this._api = api;
    this._onChange = onChange ?? null;
  }

  // =========================================================================
  // Explicit trigger — called when a component fires an issue:trigger event.
  // =========================================================================

  public trigger(context: IssueTriggerContext['media_load']): void {
    this._erroredTargetIDs.add(context.targetID);
  }

  // =========================================================================
  // Detection — called by the manager on every state change.
  // =========================================================================

  public detectDynamic(state: ConditionState): void {
    if (!isAnyMediaViewName(state.view)) {
      this._deactivate();
      return;
    }

    if (state.mediaLoadedInfo) {
      this._handleMediaLoaded(state);
    } else {
      this._handleMediaNotLoaded(state);
    }
  }

  // =========================================================================
  // State queries — called by the manager to read current state.
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
    const targets = new Set(this._erroredTargetIDs);
    if (this._timerTargetID) {
      targets.add(this._timerTargetID);
    }

    return {
      heading: {
        text: localize('issues.media_load.heading'),
        icon: 'mdi:cctv-off',
        severity: 'high' as const,
      },
      body: {
        text: localize('issues.media_load.text'),
      },
      ...(targets.size && {
        metadata: Array.from(targets).map((id) => ({
          text:
            id === IMAGE_VIEW_TARGET_ID_SENTINEL
              ? localize('editor.image')
              : this._api.getCameraManager().getCameraMetadata(id)?.title ?? id,
          icon: id === IMAGE_VIEW_TARGET_ID_SENTINEL ? 'mdi:image' : 'mdi:cctv',
        })),
      }),
      link: {
        url: TROUBLESHOOTING_MEDIA_URL,
        title: localize('issues.troubleshooting_guide'),
      },
      controls: [createRetryControl(this.key)],
    };
  }

  // =========================================================================
  // Retry — called by the manager to schedule a media reload.
  // =========================================================================

  public needsRetry(): boolean {
    return this._issueActive;
  }

  public retry(): boolean {
    // Build the set of targets to retry: all errored targets plus the
    // target the pending timer was tracking (so a user-initiated retry
    // works even before the timeout fires).
    const retryTargets = new Set(this._erroredTargetIDs);
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

    // Intentionally keep _issueActive, _erroredTargetIDs, and the pending
    // timer in place. The issue stays visible while the provider
    // re-attempts loading underneath. If the retry succeeds,
    // _handleMediaLoaded will clear everything when media:loaded fires. If
    // it fails silently (e.g. bogus stream name), the error stays visible
    // immediately — no new 10s grace period.
    this._api.getViewManager().setViewWithMergedContext({ mediaEpoch });
    return false;
  }

  // =========================================================================
  // Lifecycle.
  // =========================================================================

  public reset(): void {
    this._deactivate();
    this._erroredTargetIDs.clear();
  }

  // =========================================================================
  // Private helpers.
  // =========================================================================

  // Media loaded successfully: deactivate and clear the error for this target
  // so it won't immediately re-trigger on the next evaluation.
  private _handleMediaLoaded(state: ConditionState): void {
    this._deactivate();
    if (state.targetID) {
      this._erroredTargetIDs.delete(state.targetID);
    }
  }

  // Media not yet loaded: activate immediately if there is a known provider
  // error for this target, otherwise start a timeout to detect slow loads.
  private _handleMediaNotLoaded(state: ConditionState): void {
    // No targetID means no provider is actively rendering media (e.g. the
    // viewer shows "No media to display" instead of showing a player). Don't
    // start the timeout as there's nothing to wait for.
    if (!state.targetID) {
      this._deactivate();
      return;
    }

    if (this._hasError(state)) {
      this._activate();
      return;
    }

    const targetID = state.targetID;

    // When the target changes to one without a known error, clear the active
    // state so the new target gets its own timeout window instead of
    // inheriting the previous target's error.
    if (this._issueActive && this._timerTargetID !== targetID) {
      this._deactivate();
    }

    // Start (or restart) the timer for this target.
    if (!this._timer.isRunning() || this._timerTargetID !== targetID) {
      this._timerTargetID = targetID;
      this._timer.start(MEDIA_LOADING_TIMEOUT_SECONDS, () => {
        // Record the error on timeout so retry() knows which epoch to bump.
        // targetID is guaranteed non-null here — the null case bails at the
        // top of _handleMediaNotLoaded.
        this._erroredTargetIDs.add(targetID);
        this._activate();
        this._onChange?.();
      });
    }
  }

  private _hasError(state: ConditionState): boolean {
    return !!state.targetID && this._erroredTargetIDs.has(state.targetID);
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
