export const HA_MEDIA_SOURCE_ROOT = 'media-source://';

export const isMediaSourceID = (value: string): boolean =>
  value.startsWith(HA_MEDIA_SOURCE_ROOT);
