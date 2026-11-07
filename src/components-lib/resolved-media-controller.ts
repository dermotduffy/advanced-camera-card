import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { resolveMedia, type ResolvedMediaCache } from '../ha/resolved-media.js';
import type { HomeAssistant, ResolvedMedia } from '../ha/types.js';
import { Generation } from '../utils/concurrency/generation.js';

interface ResolvedMediaControllerOptions {
  hass?: HomeAssistant;

  // The media content ID to resolve, or `null` when there is nothing to resolve
  // (e.g. the host is not yet showing this media).
  contentID?: string | null;

  cache?: ResolvedMediaCache | null;

  // DVR EVENT playlists start at this wall-clock time. Null suppresses a
  // request while the selected time is outside this recording.
  startTime?: Date | null;
  dvrkitRevision?: number;
  dvrkitSessions?: DvrkitPlaybackSessions;
}

// Owned by a carousel, so recording-hour slides share a camera's replacement
// capability without affecting other cards or grid cells.
export class DvrkitPlaybackSessions {
  private static _cleanupQueue = Promise.resolve();
  private _sessions = new Map<string, string>();
  private _queues = new Map<string, Promise<void>>();
  private _storage?: Storage;
  private _storagePrefix = '';

  constructor() {
    try {
      this._storage = window.sessionStorage;
      this._storagePrefix = `dvrkit.playback:${window.location.pathname}:`;
    } catch {
      // Storage can be disabled by browser policy. In-memory replacement still works.
    }
  }

  private _storedSession(entity: string): string | undefined {
    try {
      return this._storage?.getItem(this._storagePrefix + entity) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private _storeSession(entity: string, url?: string): void {
    try {
      if (url) {
        this._storage?.setItem(this._storagePrefix + entity, url);
      } else {
        this._storage?.removeItem(this._storagePrefix + entity);
      }
    } catch {
      // A storage quota does not prevent playback in the current page.
    }
  }

  private _releaseOtherPages(hass: HomeAssistant): Promise<void> {
    const cleanup = DvrkitPlaybackSessions._cleanupQueue.then(async () => {
      try {
        if (!this._storage) {
          return;
        }
        for (const key of Object.keys(this._storage)) {
          if (!key.startsWith('dvrkit.playback:') || key.startsWith(this._storagePrefix)) {
            continue;
          }
          const url = this._storage.getItem(key);
          if (url) {
            await hass.callWS({
              type: 'dvrkit/playback/url',
              entity_id: decodeURIComponent(key.slice(key.lastIndexOf(':') + 1)),
              replace_url: url,
              release: true,
            });
          }
          this._storage.removeItem(key);
        }
      } catch (e) {
        console.error(e);
      }
    });
    DvrkitPlaybackSessions._cleanupQueue = cleanup;
    return cleanup;
  }

  public async resolve(
    hass: HomeAssistant,
    contentID: string,
    startTime: Date | undefined,
    isCurrent: () => boolean,
  ): Promise<ResolvedMedia | null> {
    const entity = contentID.slice('dvrkit://'.length).split('/')[0];
    let result: ResolvedMedia | null = null;
    const queue = (this._queues.get(entity) ?? Promise.resolve()).then(async () => {
      await this._releaseOtherPages(hass);
      if (!isCurrent()) {
        return;
      }
      const replaceURL = this._sessions.get(entity) ?? this._storedSession(entity);
      result = await resolveMedia(hass, contentID, null, {
        ...(startTime && { start: startTime }),
        ...(replaceURL && { replaceURL }),
      });
      if (result) {
        // Even a request superseded while in flight opened a session. Retain
        // its exact capability so the next request can close it.
        this._sessions.set(entity, result.url);
        this._storeSession(entity, result.url);
      }
    });
    this._queues.set(entity, queue);
    await queue;
    return result;
  }

  public release(hass: HomeAssistant): void {
    for (const [entity, previous] of this._queues) {
      const queue = previous.then(async () => {
        const replaceURL = this._sessions.get(entity);
        this._sessions.delete(entity);
        if (this._storedSession(entity) === replaceURL) {
          this._storeSession(entity);
        }
        if (replaceURL) {
          try {
            await hass.callWS({
              type: 'dvrkit/playback/url',
              entity_id: decodeURIComponent(entity),
              replace_url: replaceURL,
              release: true,
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
      this._queues.set(entity, queue);
    }
  }
}

/**
 * Resolves a media content ID to the media it refers to.
 */
export class ResolvedMediaController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _getOptionsCallback: () => ResolvedMediaControllerOptions;

  private _value: ResolvedMedia | null = null;

  // Inputs of the last request.
  private _targetContentID: string | null = null;
  private _targetCache: ResolvedMediaCache | null = null;
  private _targetStartTime: number | undefined;
  private _targetDvrkitRevision: number | undefined;
  private _resolvedDvrkitStartTime: Date | null = null;
  private _resolvedDvrkitRevision: number | undefined;
  private _dvrkitSessions = new DvrkitPlaybackSessions();

  private _requestGeneration = new Generation();

  constructor(
    host: ReactiveControllerHost,
    getOptionsCallback: () => ResolvedMediaControllerOptions,
  ) {
    (this._host = host).addController(this);
    this._getOptionsCallback = getOptionsCallback;
  }

  public getValue(): ResolvedMedia | null {
    return this._value;
  }

  public getDvrkitStartTime(): Date | null {
    return this._resolvedDvrkitStartTime;
  }

  public getDvrkitRevision(): number | undefined {
    return this._resolvedDvrkitRevision;
  }

  public hostDisconnected(): void {
    this._requestGeneration.invalidate();
    const { hass, dvrkitSessions } = this._getOptionsCallback();
    if (hass && !dvrkitSessions) {
      this._dvrkitSessions.release(hass);
    }
    this._value = null;
    this._targetContentID = null;
    this._targetCache = null;
    this._targetStartTime = undefined;
    this._targetDvrkitRevision = undefined;
    this._resolvedDvrkitStartTime = null;
    this._resolvedDvrkitRevision = undefined;
  }

  public async hostUpdate(): Promise<void> {
    const { hass, contentID, cache, startTime, dvrkitSessions, dvrkitRevision } =
      this._getOptionsCallback();

    if (!hass || !contentID) {
      // Invalidate any in-flight request so a stale result cannot repopulate
      // the controller after the inputs have been cleared.
      this._requestGeneration.invalidate();
      this._value = null;
      this._targetContentID = null;
      this._targetCache = null;
      this._targetStartTime = undefined;
      this._targetDvrkitRevision = undefined;
      this._resolvedDvrkitStartTime = null;
      this._resolvedDvrkitRevision = undefined;
      return;
    }

    const isDvrkit = contentID.startsWith('dvrkit://');
    if (isDvrkit && startTime === null) {
      this._requestGeneration.invalidate();
      if (contentID !== this._targetContentID) {
        this._value = null;
        this._targetContentID = contentID;
      }
      // A later return to the same time must issue a new request, even if an
      // earlier request for that time completed after it became unseekable.
      this._targetStartTime = NaN;
      return;
    }
    const targetStartTime = isDvrkit ? startTime?.getTime() : undefined;
    const targetCache = cache ?? null;
    if (
      contentID === this._targetContentID &&
      targetCache === this._targetCache &&
      targetStartTime === this._targetStartTime &&
      (!isDvrkit || dvrkitRevision === this._targetDvrkitRevision)
    ) {
      return;
    }

    this._targetContentID = contentID;
    this._targetCache = targetCache;
    this._targetStartTime = targetStartTime;
    this._targetDvrkitRevision = dvrkitRevision;

    if (isDvrkit) {
      const requestID = this._requestGeneration.next();
      const resolved = await (dvrkitSessions ?? this._dvrkitSessions).resolve(
        hass,
        contentID,
        startTime ?? undefined,
        () => this._requestGeneration.isCurrent(requestID),
      );
      if (this._requestGeneration.isCurrent(requestID)) {
        this._value = resolved;
        this._resolvedDvrkitStartTime = resolved
          ? startTime ?? new Date(Number(contentID.split('/')[3]) * 1000)
          : null;
        this._resolvedDvrkitRevision = resolved ? dvrkitRevision : undefined;
        this._host.requestUpdate();
      }
      return;
    }

    // Read the cache here rather than leaving it to resolveMedia below, so a
    // hit can return without waiting.
    const cached = targetCache?.get(contentID) ?? null;
    if (cached) {
      this._requestGeneration.invalidate();
      this._value = cached;
      return;
    }

    this._value = null;

    const requestID = this._requestGeneration.next();
    const resolved = await resolveMedia(hass, contentID, targetCache);
    if (!this._requestGeneration.isCurrent(requestID)) {
      return;
    }

    this._value = resolved;
    this._host.requestUpdate();
  }
}
