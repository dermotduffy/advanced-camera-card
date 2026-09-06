const UNKNOWN_MIME_TYPE = 'application/octet-stream';

const IMAGE_MIME_TYPES_BY_EXTENSION = new Map([
  ['gif', 'image/gif'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);

interface MimeTypeClassification {
  isHLS: boolean;
  isImage: boolean;
  isVideo: boolean;
}

/**
 * Classifies a MIME type for player selection.
 *
 * RFC 6838 declares MIME types case-insensitive (e.g. Frigate emits
 * `application/x-mpegURL`), so input is normalized before comparison.
 */
export const classifyMimeType = (mimeType?: string): MimeTypeClassification => {
  const normalized = mimeType?.toLowerCase();
  const isHLS =
    normalized === 'application/vnd.apple.mpegurl' ||
    normalized === 'application/x-mpegurl';
  return {
    isHLS,
    isImage: !!normalized?.startsWith('image/'),
    isVideo: isHLS || !!normalized?.startsWith('video/'),
  };
};

const getImageMimeTypeFromURL = (url: string): string | null => {
  const parts = url.split('?')[0].split('.');
  return (
    IMAGE_MIME_TYPES_BY_EXTENSION.get(parts[parts.length - 1].toLowerCase()) ?? null
  );
};

/**
 * The MIME type of content a server described as `mimeType`, falling back to
 * the image type the URL's extension implies when the server did not identify
 * it. A non-image type is returned unchanged.
 *
 * Fallback may not be necessary when stable Frigate contains:
 * https://github.com/blakeblackshear/frigate/pull/24208
 */
export const resolveImageMimeType = (mimeType: string, url: string): string =>
  mimeType === UNKNOWN_MIME_TYPE ? getImageMimeTypeFromURL(url) ?? mimeType : mimeType;
