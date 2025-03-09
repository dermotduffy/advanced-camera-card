import QuickLRU from 'quick-lru';
import { HomeAssistant } from '../../ha/types';
import { ResolvedMedia, resolvedMediaSchema } from '../../types.js';
import { errorToConsole } from '../basic';
import { homeAssistantWSRequest } from './ws-request';

// It's important the cache size be at least as large as the largest likely
// media query or media items will from a given query will be evicted for other
// items in the same query (which would result in only partial results being
// returned to the user).
// Note: Each entry is about 400 bytes.
const RESOLVED_MEDIA_CACHE_SIZE = 1000;

export class ResolvedMediaCache {
  protected _cache: QuickLRU<string, ResolvedMedia>;

  constructor() {
    this._cache = new QuickLRU({ maxSize: RESOLVED_MEDIA_CACHE_SIZE });
  }

  /**
   * Determine if the cache has a given id.
   * @param id
   * @returns `true` if the id is in the cache, `false` otherwise.
   */
  public has(id: string): boolean {
    return this._cache.has(id);
  }

  /**
   * Get resolved media information given an id.
   * @param id The id.
   * @returns The `ResolvedMedia` for this id.
   */
  public get(id: string): ResolvedMedia | undefined {
    return this._cache.get(id);
  }

  /**
   * Add a given ResolvedMedia to the cache.
   * @param id The id for the object.
   * @param resolvedMedia The `ResolvedMedia` object.
   */
  public set(id: string, resolvedMedia: ResolvedMedia): void {
    this._cache.set(id, resolvedMedia);
  }
}

/**
 * Resolve a given media source item.
 * @param hass The Home Assistant object.
 * @param mediaContentID The media content ID.
 * @param cache An optional ResolvedMediaCache object.
 * @returns The resolved media or `null`.
 */
export const resolveMedia = async (
  hass: HomeAssistant,
  mediaContentID: string,
  cache?: ResolvedMediaCache,
): Promise<ResolvedMedia | null> => {
  const cachedValue = cache ? cache.get(mediaContentID) : undefined;
  if (cachedValue) {
    return cachedValue;
  }
  const request = {
    type: 'media_source/resolve_media',
    media_content_id: mediaContentID,
  };
  let resolvedMedia: ResolvedMedia | null = null;
  try {
    resolvedMedia = await homeAssistantWSRequest(hass, resolvedMediaSchema, request);
  } catch (e) {
    errorToConsole(e as Error);
  }
  if (cache && resolvedMedia) {
    cache.set(mediaContentID, resolvedMedia);
  }
  return resolvedMedia;
};
