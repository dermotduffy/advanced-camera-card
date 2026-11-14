import { format } from 'date-fns';

import type { CapturedFrame } from '../types';
import type { View } from '../view/view';

export const screenshotImage = (image: HTMLImageElement): string | null => {
  return screenshotElement(image, image.naturalWidth, image.naturalHeight);
};

export const screenshotVideo = (video: HTMLVideoElement): string | null => {
  return screenshotElement(video, video.videoWidth, video.videoHeight);
};

/**
 * A video's current frame at the video's own size: drawn onto a canvas at
 * once, so it can be taken while the video is being removed, and encoded to a
 * JPEG `data:` URL afterwards (`toBlob`) rather than within this call. Null
 * when no 2D context is available.
 */
export const captureVideoFrame = (video: HTMLVideoElement): CapturedFrame | null => {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const url = new Promise<string | null>((resolve) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        CAPTURE_QUALITY,
      );
    } catch {
      resolve(null);
    }
  });
  return { canvas, url };
};

// The JPEG quality of a captured frame (one is kept per camera).
const CAPTURE_QUALITY = 0.8;

const screenshotElement = (
  src: CanvasImageSource,
  width: number,
  height: number,
): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg');
};

export const generateScreenshotFilename = (view?: View | null): string => {
  if (view?.is('live') || view?.is('image')) {
    return `${view.view}${view.camera ? `_${view.camera}` : ''}_${format(
      new Date(),
      `yyyy-MM-dd-HH-mm-ss`,
    )}.jpg`;
  } else if (view?.isViewerView()) {
    const media = view.queryResults?.getSelectedResult();
    const id = media?.getID() ?? null;
    return `${view.view}${view.camera ? `_${view.camera}` : ''}${id ? `_${id}` : ''}.jpg`;
  }
  return 'screenshot.jpg';
};
