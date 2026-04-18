import { CameraMediaReviewedFilter } from '../../config/schema/cameras';
import { ViewItem } from '../item';
import { ViewItemClassifier } from '../item-classifier';
import { UnifiedQuery } from '../unified-query';

/**
 * Get the reviewed filter from a query for a specific item.
 *
 * This is used to determine whether toggling the reviewed status of a media
 * item should remove it from the current results.
 *
 * @param query The query that produced the results.
 * @param item The view item to get the filter for.
 * @returns The reviewed filter (true = reviewed only, false = unreviewed only,
 *          undefined = both or ambiguous).
 */
export function getReviewedQueryFilterFromQuery(
  query?: UnifiedQuery | null,
  item?: ViewItem,
): boolean | undefined {
  if (!query || !item || !ViewItemClassifier.isMedia(item)) {
    return undefined;
  }

  const cameraID = item.getCameraID();
  if (!cameraID) {
    return undefined;
  }

  const mediaQueries = query.getMediaQueries({ cameraID });

  // Only use the filter if there's exactly one matching query (unambiguous).
  // If zero or multiple queries, return undefined (show all / no removal).
  return mediaQueries.length === 1 ? mediaQueries[0].reviewed : undefined;
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
