import { format } from 'date-fns';
import { View } from '../view/view';

export const screenshotImage = (image: HTMLImageElement): string | null => {
  return screenshotElement(image, image.naturalWidth, image.naturalHeight);
};

export const screenshotVideo = (video: HTMLVideoElement): string | null => {
  return screenshotElement(video, video.videoWidth, video.videoHeight);
};

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
