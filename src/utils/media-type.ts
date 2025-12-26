import { Capabilities } from '../camera-manager/capabilities';
import { LiveMediaType } from '../config/schema/live';

/**
 * Resolves the 'auto' media type to a concrete media type based on camera capabilities.
 * @param capabilities The camera capabilities.
 * @param mediaType The media type to resolve (may be 'auto').
 * @returns The resolved media type, or null if no capabilities match.
 */
export const resolveLiveMediaType = (
  mediaType: LiveMediaType,
  capabilities?: Capabilities | null,
): Exclude<LiveMediaType, 'auto'> | null => {
  if (mediaType !== 'auto') {
    return mediaType;
  }

  if (capabilities?.has('reviews')) {
    return 'reviews';
  } else if (capabilities?.has('clips') || capabilities?.has('snapshots')) {
    return 'events';
  } else if (capabilities?.has('recordings')) {
    return 'recordings';
  }

  return null;
};
