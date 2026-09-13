import type { CameraMediaReviewedFilter } from '../../config/schema/cameras';
import { getUnanimousValue } from '../../utils/basic';
import type { ViewItem } from '../item';
import { ViewItemClassifier } from '../item-classifier';
import type { UnifiedQuery } from '../unified-query';

/**
 * Get a boolean filter from a query for a specific item.
 *
 * This is used to determine whether toggling that status on a media item should
 * remove it from the current results.
 *
 * @param field The query field holding the filter.
 * @param query The query that produced the results.
 * @param item The view item to get the filter for.
 * @returns The filter (true = matching only, false = non-matching only,
 *          null = both or ambiguous).
 */
export function getBooleanQueryFilter(
  field: 'reviewed' | 'favorite',
  query?: UnifiedQuery | null,
  item?: ViewItem,
): boolean | null {
  if (!query || !item || !ViewItemClassifier.isMedia(item)) {
    return null;
  }

  const cameraID = item.getCameraID();
  if (!cameraID) {
    return null;
  }

  // Filter if all media queries agree unanimously on what it should be.
  return getUnanimousValue(
    query.getMediaQueries({ cameraID }).map((mediaQuery) => mediaQuery[field]),
  );
}

/**
 * Convert a reviewed config value to a boolean filter.
 * @param reviewed The config value ('reviewed', 'all', 'unreviewed' or undefined)
 * @returns true (reviewed only), false (unreviewed only), or undefined (all)
 */
export function getReviewedQueryFilterFromConfig(
  reviewed?: CameraMediaReviewedFilter,
): boolean | undefined {
  return reviewed === 'reviewed' ? true : reviewed === 'all' ? undefined : false;
}
