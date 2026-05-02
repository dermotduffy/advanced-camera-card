import { ReactiveController, ReactiveControllerHost } from 'lit';
import { MediaLoadedInfo, MediaLoadedInfoEventDetail } from '../types';
import { onAbort } from '../utils/abort-signal';

interface MediaLoadedInfoSinkConfig {
  // The currently active target the sink should expose via `get()` / `has()`
  // and notify the callback for. Polled on every host update so the sink can
  // detect selection changes (e.g. carousel slide change) without explicit
  // notification.
  getTargetID: () => string | null;

  // Fires when the active info changes — i.e. when the active target's entry
  // transitions (load arrives, abort, or selection changes the active entry).
  // Loads for other targets are cached but do not fire the callback.
  callback?: (info: MediaLoadedInfo | null) => void;
}

/**
 * Sink-side ReactiveController for the media-loaded lifecycle.
 *
 * Listens for `advanced-camera-card:media:loaded` events bubbling through the
 * host's subtree and caches them keyed by `MediaLoadedInfo.targetID`. The sink
 * exposes only the entry for the currently active target (via `getTargetID`).
 *
 * This per-target shape is what makes the sink work inside carousels that
 * render multiple slides concurrently: non-active slides may load and update
 * the cache, but they don't become the carousel's active media. When the
 * user selects a slide whose media has already loaded, the sink immediately
 * exposes the cached entry.
 *
 * Lifecycle asymmetry — `callback` fires on:
 *  - the active target's load arrival,
 *  - the active target's source aborting (with `null`), and
 *  - selection changing to / from a target whose active info differs.
 *
 * It does NOT fire on the sink's own `hostDisconnected`: the host is detaching
 * and won't render, so notifying consumers of a "transition to null" is moot.
 * State is still cleared so a later reconnect doesn't observe stale info.
 */
export class MediaLoadedInfoSinkController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _config: MediaLoadedInfoSinkConfig;

  // Per-target cache. Each entry holds the latest info dispatched under that
  // targetID; aborts clear only the matching entry, scoped by reference so a
  // stale abort can't blow away an entry that's since been overwritten.
  private _byTarget = new Map<string, MediaLoadedInfo>();

  // The targetID whose info we last surfaced — drives `hostUpdated` change
  // detection. `_lastActiveInfo` records what the callback last saw, so we
  // don't fire it for no-op selection changes (e.g. selection changes but
  // both old and new are null/loaded with the same info reference).
  private _lastActiveTargetID: string | null = null;
  private _lastActiveInfo: MediaLoadedInfo | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    config: MediaLoadedInfoSinkConfig,
  ) {
    this._host = host;
    this._config = config;
    host.addController(this);
  }

  public hostConnected(): void {
    this._host.addEventListener('advanced-camera-card:media:loaded', this._handler);
  }

  public hostUpdated(): void {
    // Detect selection changes — `getTargetID` is owned by the host and may
    // flip when its props change (carousel slide change, view change, etc.).
    const newID = this._config.getTargetID();
    if (newID !== this._lastActiveTargetID) {
      this._lastActiveTargetID = newID;
      this._notifyIfActiveChanged();
    }
  }

  public hostDisconnected(): void {
    this._host.removeEventListener('advanced-camera-card:media:loaded', this._handler);

    // Clear without firing `callback`/`requestUpdate`: see class doc.
    this._byTarget.clear();
    this._lastActiveTargetID = null;
    this._lastActiveInfo = null;
  }

  public get(): MediaLoadedInfo | null {
    const id = this._config.getTargetID();
    return id ? this._byTarget.get(id) ?? null : null;
  }

  public has(): boolean {
    return !!this.get();
  }

  private _handler = (ev: CustomEvent<MediaLoadedInfoEventDetail>): void => {
    const id = ev.detail.info.targetID;
    if (!id) {
      return;
    }
    this._byTarget.set(id, ev.detail.info);
    if (id === this._config.getTargetID()) {
      this._notifyIfActiveChanged();
    }

    onAbort(ev.detail.signal, () => {
      // Reference check: a newer load for the same target has overwritten
      // this entry, so this stale abort is a no-op.
      if (this._byTarget.get(id) !== ev.detail.info) {
        return;
      }
      this._byTarget.delete(id);
      if (id === this._config.getTargetID()) {
        this._notifyIfActiveChanged();
      }
    });
  };

  private _notifyIfActiveChanged(): void {
    const active = this.get();
    if (active === this._lastActiveInfo) {
      return;
    }
    this._lastActiveInfo = active;
    this._config.callback?.(active);
    this._host.requestUpdate();
  }
}
