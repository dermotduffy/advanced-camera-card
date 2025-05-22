import { orderBy, uniqBy } from 'lodash-es';
import { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';

export const sortItems = <T extends ViewItem>(itemArray: T[]): T[] => {
  return orderBy(
    // Ensure uniqueness by the ID (if specified), otherwise all elements
    // are assumed to be unique.
    uniqBy(itemArray, (item) => item.getID() ?? item),

    [
      // Pull folders to the front.
      (item) => !ViewItemClassifier.isFolder(item),

      // Sort by time and id.
      (item) =>
        ViewItemClassifier.isMedia(item)
          ? item.getStartTime() ?? item.getID()
          : item.getID(),
    ],
    ['asc', 'asc'],
  );
};
