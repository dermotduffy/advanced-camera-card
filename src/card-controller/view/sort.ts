import { orderBy, uniqBy } from 'lodash-es';

import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';

/**
 * Sort items oldest first by when they start. An item without a start sorts as
 * the oldest. When the time is the same, folders come before media, after which
 * items are ordered by ID.
 */
export const sortItems = <T extends ViewItem>(itemArray: T[]): T[] => {
  return orderBy(
    // Ensure uniqueness by the ID (if specified), otherwise all elements
    // are assumed to be unique.
    uniqBy(itemArray, (item) => item.getID() ?? item),

    [
      (item) => item.getStartTime()?.getTime() ?? -Infinity,
      (item) => (ViewItemClassifier.isFolder(item) ? 0 : 1),
      (item) => item.getID() ?? '',
    ],
    ['asc', 'asc', 'asc'],
  );
};
