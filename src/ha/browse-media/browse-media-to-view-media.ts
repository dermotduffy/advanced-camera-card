import { isTruthy } from '../../utils/basic';
import { ViewItem, ViewMedia, ViewMediaSourceOptions } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { BrowseMediaViewItemFactory } from './item-factory';
import { BrowseMediaMetadata, RichBrowseMedia } from './types';

export const getViewMediaFromBrowseMediaArray = (
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[],
  options?: ViewMediaSourceOptions,
): ViewMedia[] => {
  return getViewItemsFromBrowseMediaArray(browseMedia, options).filter((item) =>
    ViewItemClassifier.isMedia(item),
  );
};

export const getViewItemsFromBrowseMediaArray = <M extends BrowseMediaMetadata>(
  browseMedia: RichBrowseMedia<M>[],
  options?: ViewMediaSourceOptions,
): ViewItem[] => {
  return browseMedia
    .map((item) =>
      BrowseMediaViewItemFactory.create(item, {
        cameraID: item._metadata?.cameraID,
        ...options,
      }),
    )
    .filter(isTruthy);
};
