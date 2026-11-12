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

  public hostDisconnected(): void {
    this._requestGeneration.invalidate();
    this._value = null;
    this._targetContentID = null;
    this._targetCache = null;
  }

  public async hostUpdate(): Promise<void> {
    const { hass, contentID, cache } = this._getOptionsCallback();

    if (!hass || !contentID) {
      // Invalidate any in-flight request so a stale result cannot repopulate
      // the controller after the inputs have been cleared.
      this._requestGeneration.invalidate();
      this._value = null;
      this._targetContentID = null;
      this._targetCache = null;
      return;
    }

    const targetCache = cache ?? null;
    if (contentID === this._targetContentID && targetCache === this._targetCache) {
      return;
    }

    this._targetContentID = contentID;
    this._targetCache = targetCache;

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
