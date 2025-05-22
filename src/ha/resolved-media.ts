import { LRUCache } from '../cache/lru';
import { errorToConsole } from '../utils/basic';
import { HomeAssistant, ResolvedMedia, resolvedMediaSchema } from './types';
import { homeAssistantWSRequest } from './ws-request';

// It's important the cache size be at least as large as the largest likely
// media query or media items will from a given query will be evicted for other
// items in the same query (which would result in only partial results being
// returned to the user).
// Note: Each entry is about 400 bytes.
const RESOLVED_MEDIA_CACHE_SIZE = 1000;

export class ResolvedMediaCache extends LRUCache<string, ResolvedMedia> {
  constructor() {
    super(RESOLVED_MEDIA_CACHE_SIZE);
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
  cache?: ResolvedMediaCache | null,
): Promise<ResolvedMedia | null> => {
  const cachedValue = cache?.get(mediaContentID) ?? null;
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
