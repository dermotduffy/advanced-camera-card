import { uniq } from 'lodash-es';

import type { TimeBasedDataQuery } from '../../../query-source';

/**
 * Filter sibling folders to those that may contain media within a time range.
 *
 * A folder only has a start date, so it is assumed to contain media that starts
 * at any time until the next later folder starts. The most recent folder has no
 * next folder, so is assumed to still be in use. The folder before the first in
 * range is always included, as its last media may run into the range (e.g. a
 * recording that crosses midnight). Folders without a start date are always
 * included.
 */
export const filterFoldersByTimeRange = <T>(
  folders: T[],
  timeRange: Partial<TimeBasedDataQuery>,
  getStartDate: (folder: T) => Date | null,
): T[] => {
  const { start, end } = timeRange;
  if (!start && !end) {
    return folders;
  }

  const startTimes = folders.map((folder) => getStartDate(folder)?.getTime() ?? null);

  // Of the folders that start at or before the range does, the latest is the
  // first in range, and the one before that also needs to be included.
  const startTimesBeforeRange = uniq(startTimes)
    .filter(
      (time): time is number => !!start && time !== null && time <= start.getTime(),
    )
    .sort((a, b) => b - a);
  const earliestTime = startTimesBeforeRange[1] ?? -Infinity;
  const latestTime = end?.getTime() ?? Infinity;

  return folders.filter((_folder, index) => {
    const time = startTimes[index];
    return time === null || (time >= earliestTime && time <= latestTime);
  });
};
