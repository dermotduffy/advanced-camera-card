import { sub, type Duration } from 'date-fns';

import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import type { UnifiedQuery } from '../../view/unified-query';
import type { UnifiedQueryBuilder } from '../../view/unified-query-builder';
import type { UnifiedQueryRunner } from '../../view/unified-query-runner';

// How far back from now the timeline view searches for folder media, after
// first searching its own window.
const TIMELINE_FOLDER_SEARCH_DURATIONS: Duration[] = [
  { days: 1 },
  { weeks: 1 },
  { months: 1 },
];

interface TimelineQueryResult {
  query: UnifiedQuery;
  items: ViewItem[];
}

const hasMediaSince = (items: ViewItem[], start: Date): boolean =>
  items
    .filter((item) => ViewItemClassifier.isMedia(item))
    .some((media) => {
      const startTime = media.getStartTime();
      return !!startTime && startTime >= start;
    });

/**
 * Get the starter query, and its results, for the timeline view.
 *
 * The timeline view opens on the most recent media. A camera query asks each
 * camera for its most recent media, but a folder query has no limit: without a
 * time range it opens every folder to find all of its media, which is slow when
 * there are many folders (e.g. one per day). With a time range, it opens only
 * the dated folders that may contain media within it.
 *
 * The time of the most recent folder media is unknown, so this searches
 * increasingly far back from now until a search finds media. If the furthest
 * search finds none, no folder media is returned, and the timeline fetches
 * older folder media as it is panned back.
 */
export const searchTimelineQuery = async (
  builder: UnifiedQueryBuilder,
  runner: UnifiedQueryRunner,
  windowSeconds: number,
  allowCached?: boolean,
): Promise<TimelineQueryResult | null> => {
  const now = new Date();
  const searchStarts = [
    { seconds: windowSeconds },
    ...TIMELINE_FOLDER_SEARCH_DURATIONS,
  ].map((duration) => sub(now, duration));

  let result: TimelineQueryResult | null = null;
  for (const start of searchStarts) {
    const query = builder.buildDefaultCameraQuery({
      folderTimeRange: { start },
    });
    if (!query) {
      break;
    }

    const items = await runner.execute(query, { allowCached });
    result = { query, items };

    // The timeline opens on the newest media, so searching further back cannot
    // change where it opens: without folder queries every search is the same,
    // and once there is media since this start, an earlier start only adds
    // older folder media.
    if (!query.getFolderQueries().length || hasMediaSince(items, start)) {
      break;
    }
  }

  return result;
};
