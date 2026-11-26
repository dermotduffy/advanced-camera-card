import { format } from 'date-fns';

import type { View } from '../view/view';

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
