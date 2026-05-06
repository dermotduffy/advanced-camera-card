export interface MimeTypeClassification {
  isHLS: boolean;
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
  const isVideo = isHLS || !!normalized?.startsWith('video/');
  return { isHLS, isVideo };
};
