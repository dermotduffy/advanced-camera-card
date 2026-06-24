import type { Endpoint } from '../types';
import { canonicalizeHAURL } from './canonical-url';
import { resolveMedia, type ResolvedMediaCache } from './resolved-media';
import type { HomeAssistant } from './types';

export const getMediaDownloadPath = async (
  hass: HomeAssistant,
  contentID?: string | null,
  resolvedMediaCache?: ResolvedMediaCache | null,
): Promise<Endpoint | null> => {
  if (!contentID) {
    return null;
  }
  const resolvedMedia = await resolveMedia(hass, contentID, resolvedMediaCache);
  return resolvedMedia ? { endpoint: canonicalizeHAURL(hass, resolvedMedia.url) } : null;
};
