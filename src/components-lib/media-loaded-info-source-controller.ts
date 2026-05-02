import { ReactiveController, ReactiveControllerHost } from 'lit';
import { isEqual, omit } from 'lodash-es';
import {
  MediaLoadedInfo,
  MediaLoadedInfoEventDetail,
  UntargetedMediaLoadedInfo,
} from '../types';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event';

// Structural equality on `MediaLoadedInfo`, except `mediaPlayerController` is
// reference-compared. Implementations hold a `LitElement` host whose own
// properties include all `@property` bindings (`hass`, `cameraManager`, etc.)
// plus Lit's transient render bookkeeping; deep-walking those is expensive,
// reaches across unrelated app state, and produces false negatives from fields
// that flip between renders. Reference identity is the right granularity: same
// controller instance = same player.
const isEquivalentInfo = (a: MediaLoadedInfo | null, b: MediaLoadedInfo): boolean =>
  !!a &&
  a.mediaPlayerController === b.mediaPlayerController &&
  isEqual(omit(a, 'mediaPlayerController'), omit(b, 'mediaPlayerController'));

interface MediaLoadedInfoSourceConfig {
  getTargetID: () => string | null;
}

type TargetedMediaLoadedInfo = MediaLoadedInfo & { targetID: string };

/**
 * Source-side ReactiveController for the media-loaded lifecycle.
 *
 * On `set(info)` dispatches a bubbling `advanced-camera-card:media:loaded`
 * event with `{ info, signal }`. Listeners along the bubble path register
 * cleanup via the signal. The signal fires on host disconnect.
 *
 * Reconnect path: Lit may reuse the host across disconnect/reconnect. We
 * re-dispatch from `_lastSet` on `hostConnected` so the registration survives
 * without needing the underlying media to re-fire a load (e.g., HaHlsPlayer
 * keeps the same `<video>`).
 *
 * Aggregator parents (e.g., `ha-camera-stream`) sit on the bubble path; they
 * can `stopPropagation` on inner-leaf events and dispatch their own via their
 * own source controller, so consumers above the boundary only see the
 * aggregate.
 */
export class MediaLoadedInfoSourceController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _config: MediaLoadedInfoSourceConfig;

  // AbortController for the active dispatch; aborting it fires the cleanup
  // callbacks consumers registered against the event's `signal`. Non-null iff
  // a `media:loaded` is currently in flight, in which case `_lastSet` is the
  // info that was dispatched.
  private _abort: AbortController | null = null;

  // Survives disconnect so we can re-dispatch on reconnect. Only ever holds
  // info validated by `set` — i.e., always has a targetID.
  private _lastSet: TargetedMediaLoadedInfo | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    config: MediaLoadedInfoSourceConfig,
  ) {
    this._host = host;
    this._config = config;
    host.addController(this);
  }

  public hostConnected(): void {
    // Two early-returns:
    //  - `!_lastSet`: nothing to replay — either the host has never seen a
    //    media load or the cache was discarded as stale on a prior reconnect
    //    (see below).
    //  - `_abort` non-null: a dispatch is already live, meaning we're already
    //    registered with consumers. Re-firing would orphan the prior
    //    `AbortController` (no one would ever abort it) and emit a duplicate
    //    event. Defensive against `hostConnected` firing without an intervening
    //    `hostDisconnected`.
    if (!this._lastSet || this._abort) {
      return;
    }

    // Revalidate against the current targetID — the host's property may have
    // flipped while we were disconnected. Replaying the cached info under a
    // stale targetID would misregister with the manager.
    if (this._lastSet.targetID === this._config.getTargetID()) {
      this._dispatchLoad(this._lastSet);
    } else {
      this._lastSet = null;
    }
  }

  public hostDisconnected(): void {
    this._unload();
  }

  public set(info: UntargetedMediaLoadedInfo): void {
    const targetID = this._config.getTargetID();
    if (!targetID) {
      return;
    }

    // If the host's targetID changed since the prior dispatch, abort the
    // prior dispatch's signal *before* registering the new one. Why:
    //  - When we dispatched the prior load, consumers (the manager, sinks,
    //    etc.) attached `onAbort` cleanup callbacks to that signal. The
    //    manager's callback is `_clearTarget(<old targetID>, owner)`.
    //  - If we skip the abort and proceed to `_dispatchLoad(new)`, we
    //    overwrite `_abort` with a fresh `AbortController`. The old
    //    controller becomes unreachable from us, but its signal is still
    //    held by consumers' listeners. We never call `.abort()` on it, so
    //    those cleanup callbacks never fire. The manager's
    //    `_active[<old targetID>]` entry zombies until the next time the
    //    host disconnects (which aborts only the *new* controller).
    //  - Aborting first triggers the old cleanup synchronously: the
    //    manager clears its old entry, sinks drop their cached info, and
    //    we then register the new entry cleanly.
    //
    // No current consumer rebinds targetID in-place (the substream layer
    // keeps it stable above the playback chain), but the abstraction must
    // remain safe in that general case.
    if (this._lastSet && this._lastSet.targetID !== targetID) {
      this._unload();
    }
    const validated: TargetedMediaLoadedInfo = { ...info, targetID };
    if (isEquivalentInfo(this._lastSet, validated)) {
      return;
    }
    this._lastSet = validated;
    this._dispatchLoad(validated);
  }

  private _unload(): void {
    this._abort?.abort();
    this._abort = null;
  }

  private _dispatchLoad(info: TargetedMediaLoadedInfo): void {
    this._abort = new AbortController();
    fireAdvancedCameraCardEvent<MediaLoadedInfoEventDetail>(this._host, 'media:loaded', {
      info,
      signal: this._abort.signal,
    });
  }
}
