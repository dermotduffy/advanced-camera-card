import { Endpoint } from '../types';
import { canonicalizeHAURL } from './canonical-url';
import { ResolvedMediaCache, resolveMedia } from './resolved-media';
import { HomeAssistant } from './types';

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
