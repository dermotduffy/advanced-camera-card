import { isEqual } from 'lodash-es';

import type {
  MediaLoadedInfoEventDetail,
  MediaPlayerController,
  UnsubscribeCallback,
} from '../../../../types';
import { onAbort } from '../../../../utils/abort-signal';
import { VisibilityObserver } from '../../../visibility-observer';
import type { LivenessDetector, LivenessVerdict } from '../stream-liveness-controller';

const MEDIA_LOADED_EVENT = 'advanced-camera-card:media:loaded';

/**
 * Detects a silent freeze by observing the media player's own liveness signal
 * (`subscribeLiveness`): when the player reports it has stopped delivering
 * media, this reports the stream not live so the wrapper shows the reconnecting
 * placeholder. How a player detects that (e.g. a video watching frame progress)
 * is the player's concern.
 *
 * It only watches while a stall is actionable -- the stream is loaded AND this
 * provider is actually visible to the user (on-screen and the tab is focused).
 * An off-screen or backgrounded video legitimately stops presenting media (the
 * browser pauses `requestVideoFrameCallback`), which is not considered a real
 * freeze. Visibility comes from the shared `VisibilityObserver` (intersection +
 * tab visibility), which correctly tracks every visible provider in a grid, not
 * just the single selected camera.
 *
 * Recovery is not self-driven. Once a freeze is reported and the placeholder
 * unmounts the frozen stream, the media player is gone -- so the detector holds
 * its not-live verdict rather than flipping back to live, which would clear the
 * placeholder and remount immediately in an unthrottled loop. The throttled
 * media_unavailable issue (see issue-manager.ts) retry remounts a fresh provider (a
 * new detector) to re-check the stream instead.
 */
export class MediaPlayerLivenessDetector implements LivenessDetector {
  private _host: HTMLElement;
  private _onChange: () => void;

  private _verdict: LivenessVerdict = { state: 'unknown' };

  private _visibilityObserver: VisibilityObserver | null = null;
  private _visible = false;

  private _mediaPlayer: MediaPlayerController | null = null;

  private _watchedPlayer: MediaPlayerController | null = null;
  private _unsubscribeLiveness: UnsubscribeCallback | null = null;

  constructor(host: HTMLElement, onChange: () => void) {
    this._host = host;
    this._onChange = onChange;
  }

  public subscribe(): void {
    this._host.addEventListener(MEDIA_LOADED_EVENT, this._onMediaLoaded);
    this._visibilityObserver = new VisibilityObserver(this._onVisibleChange, {
      emitInitial: true,
    });
    this._visibilityObserver.setRoot(this._host);
  }

  public unsubscribe(): void {
    // Retain the verdict so a reconnect resumes where it left off; use reset()
    // to discard it.
    this._host.removeEventListener(MEDIA_LOADED_EVENT, this._onMediaLoaded);
    this._visibilityObserver?.destroy();
    this._visibilityObserver = null;
    this._unwatch();
  }

  public reset(): void {
    // The underlying stream changed (e.g. a substream switch): discard the
    // verdict and re-evaluate against the new media.
    this._unwatch();
    this._setVerdict({ state: 'unknown' });
  }

  public getVerdict(): LivenessVerdict {
    return this._verdict;
  }

  private _onVisibleChange = (visible: boolean): void => {
    this._visible = visible;
    this._watch();
  };

  private _onMediaLoaded = (ev: CustomEvent<MediaLoadedInfoEventDetail>): void => {
    const player = ev.detail.info.mediaPlayerController ?? null;
    this._mediaPlayer = player;

    // Drop the player when the source retires this media (unmount), so a stale
    // player is never watched.
    onAbort(ev.detail.signal, () => {
      if (this._mediaPlayer === player) {
        this._mediaPlayer = null;
        this._watch();
      }
    });

    this._watch();
  };

  private _watch(): void {
    // Only a visible player that exposes the liveness capability carries an
    // actionable stall.
    const player = this._visible ? this._mediaPlayer : null;
    const target = player?.subscribeLiveness ? player : null;
    if (target === this._watchedPlayer) {
      return;
    }

    this._unwatch();
    this._watchedPlayer = target;

    if (player?.subscribeLiveness) {
      // A `live` verdict left over from the last watch means media was flowing
      // then, not now. Drop it, so `live` always means something seen during
      // this watch. The `not_live` hold below is kept on purpose.
      if (this._verdict.state === 'live') {
        this._setVerdict({ state: 'unknown' });
      }

      // Start (or resume) watching; the verdict stays `unknown` until a real
      // frame or a stall is observed.
      this._unsubscribeLiveness = player.subscribeLiveness((isLive) =>
        this._onLiveness(isLive),
      );
      return;
    }

    // The media is gone because our own not-live placeholder unmounted the
    // frozen stream: hold that verdict. Flipping back to live here would clear
    // the placeholder and remount into the same freeze; recovery is instead the
    // throttled media_unavailable retry, which replaces this whole provider.
    if (!this._mediaPlayer && this._verdict.state === 'not_live') {
      return;
    }

    // Otherwise there is no current evidence: the provider is off-screen (an
    // off-screen video legitimately stops presenting frames) or exposes no
    // liveness signal, or the media went away for an ordinary reason. Report
    // `unknown` rather than leaving a stale `live` that would suppress other
    // detectors (e.g. entity availability).
    this._setVerdict({ state: 'unknown' });
  }

  private _onLiveness(isLive: boolean): void {
    this._setVerdict(
      isLive
        ? { state: 'live', authority: 'direct' }
        : {
            state: 'not_live',
            authority: 'direct',
            renderPlaceholder: true,
            reason: 'stalled',
          },
    );
  }

  private _unwatch(): void {
    this._unsubscribeLiveness?.();
    this._unsubscribeLiveness = null;
    this._watchedPlayer = null;
  }

  private _setVerdict(verdict: LivenessVerdict): void {
    if (isEqual(this._verdict, verdict)) {
      return;
    }
    this._verdict = verdict;
    this._onChange();
  }
}
