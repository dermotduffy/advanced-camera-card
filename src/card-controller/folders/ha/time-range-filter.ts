import { sub, type Duration } from 'date-fns';
import { uniq } from 'lodash-es';

import type { TimeBasedDataQuery } from '../../../query-source';

// The longest that media is assumed to last.
const MEDIA_MAX_DURATION: Duration = { hours: 24 };

/**
 * Filter sibling folders to those that *may* contain media within a time range.
 *
 * A folder only has a start time, so it is assumed to contain media that starts
 * at any time until the *next* later folder starts, or at any time after its
 * own start for the most recent folder. Media is assumed to last at most 24
 * hours, so media starting up to 24 hours before the time range may still meet
 * the time criteria. The function returns:
 *
 * - Folders without a start time.
 * - Folders that *may* contain media starting between 24 hours before the time
 *   range starts and when it ends.
 *
 * For example, given day folders `23`, `24`, `25` and `26` and a time range of
 * 10:00 to 12:00 on the 25th: media in `23` starts before the 24th, so is
 * assumed to end before the 25th, and `26` starts after the time range ends, so
 * only `24` and `25` are included.
 *
 * Folders that share a start time are included or excluded together. Without a
 * time range, every folder is included.
 */
export const filterFoldersByTimeRange = <T>(
  folders: T[],
  timeRange: Partial<TimeBasedDataQuery>,
  getStartTime: (folder: T) => Date | null,
): T[] => {
  const { start, end } = timeRange;
  if (!start && !end) {
    return folders;
  }

  const startTimes = folders.map((folder) => getStartTime(folder)?.getTime() ?? null);
  const sortedStartTimes = uniq(
    startTimes.filter((time): time is number => time !== null),
  ).sort((a, b) => a - b);

  // A folder's media starts before the next later folder starts.
  const getNextStartTime = (time: number): number =>
    sortedStartTimes.find((other) => other > time) ?? Infinity;

  const earliestMediaStart = start
    ? sub(start, MEDIA_MAX_DURATION).getTime()
    : -Infinity;
  const latestMediaStart = end?.getTime() ?? Infinity;

  return folders.filter((_folder, index) => {
    const time = startTimes[index];
    return (
      // Without a start time, the item is automatically included.
      time === null ||
      (time <= latestMediaStart && getNextStartTime(time) > earliestMediaStart)
    );
  });
};
