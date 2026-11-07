import { LRUCache } from '../cache/lru';
import { errorToConsole } from '../utils/basic';
import { resolvedMediaSchema, type HomeAssistant, type ResolvedMedia } from './types';
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
  options?: { start?: Date; replaceURL?: string },
): Promise<ResolvedMedia | null> => {
  const cachedValue = mediaContentID.startsWith('dvrkit://')
    ? null
    : cache?.get(mediaContentID) ?? null;
  if (cachedValue) {
    return cachedValue;
  }
  if (mediaContentID.startsWith('dvrkit://')) {
    const match = /^dvrkit:\/\/([^/]+)\/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(
      mediaContentID,
    );
    if (!match) {
      return null;
    }
    const recordingStart = Number(match[2]);
    const recordingEnd = Number(match[3]);
    const start = options?.start ? options.start.getTime() / 1000 : recordingStart;
    if (!Number.isFinite(start) || start < recordingStart || start >= recordingEnd) {
      return null;
    }
    try {
      const { url } = await hass.callWS<{ url: string }>({
        type: 'dvrkit/playback/url',
        entity_id: decodeURIComponent(match[1]),
        start,
        end: Math.min(recordingEnd, start + 3600),
        ...(options?.replaceURL && { replace_url: options.replaceURL }),
      });
      // Playback URLs may expire; do not put them in the resolved-media cache.
      return { url, mime_type: 'application/vnd.apple.mpegurl' };
    } catch (e) {
      errorToConsole(e);
      return null;
    }
  }
  const request = {
    type: 'media_source/resolve_media',
    media_content_id: mediaContentID,
  };
  let resolvedMedia: ResolvedMedia | null = null;
  try {
    resolvedMedia = await homeAssistantWSRequest(hass, resolvedMediaSchema, request);
  } catch (e) {
    errorToConsole(e);
  }
  if (cache && resolvedMedia) {
    cache.set(mediaContentID, resolvedMedia);
  }
  return resolvedMedia;
};
