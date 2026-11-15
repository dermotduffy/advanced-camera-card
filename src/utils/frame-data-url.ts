import type { DataURL } from '../types';
import { readBlobAsDataURL } from './blob';
import { isDataURL } from './data-url';
import { sharedDocumentVisibility } from './document-visibility';

const FRAME_JPEG_QUALITY = 0.8;

/**
 * The current frame of a video as a JPEG `data:` URL, or null when the video
 * has no frame to give.
 */
export const getVideoFrameDataURL = (
  video: HTMLVideoElement,
): Promise<DataURL | null> => {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return Promise.resolve(null);
  }
  return getDrawnFrameDataURL(video, video.videoWidth, video.videoHeight);
};

/**
 * The picture an image shows as a JPEG `data:` URL, or null when it has
 * nothing loaded or comes from another origin (which forbids reading it back).
 */
export const getImageFrameDataURL = (
  image: HTMLImageElement,
): Promise<DataURL | null> => {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
    return Promise.resolve(null);
  }
  return getDrawnFrameDataURL(image, image.naturalWidth, image.naturalHeight);
};

// The source is drawn before this returns, so the caller may destroy the source
// straight after.
const getDrawnFrameDataURL = (
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<DataURL | null> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Promise.resolve(null);
  }
  ctx.drawImage(source, 0, 0, width, height);
  return getCanvasFrameDataURL(canvas);
};

/**
 * The contents of a canvas as a JPEG `data:` URL, or null when it cannot be
 * encoded. The browser copies the canvas before this returns, so the canvas may
 * change or go away straight after.
 */
export const getCanvasFrameDataURL = async (
  canvas: HTMLCanvasElement,
): Promise<DataURL | null> => {
  try {
    // A hidden page encodes synchronously so the frame exists before Android
    // suspends the page, and is ready the moment the page is shown again. A
    // visible page encodes asynchronously, as a synchronous encode of a 1080p
    // frame blocks a phone for tens of milliseconds, enough to cause frame
    // drops. That matters even when the frame's own media is going away: the
    // block freezes everything else the page is drawing at that moment (e.g. a
    // carousel transition), and several frames may be encoded at once (e.g. a
    // grid of cameras leaving the page).
    if (!sharedDocumentVisibility.isVisible()) {
      const url = canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY);
      return isDataURL(url) ? url : null;
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', FRAME_JPEG_QUALITY),
    );
    return blob ? await readBlobAsDataURL(blob) : null;
  } catch {
    // A canvas drawn from another origin refuses to be read back.
    return null;
  }
};
