import { add, sub } from 'date-fns';

import type { DateRange } from '../range';

// Frigate buckets recordings by the hour. The default keeps one hour on either
// side of the requested window, so panning back across the hour just left is
// still a cache hit, and anything further away can be dropped. The timeline
// editor can change this.
export const DEFAULT_RECORDING_RETENTION_MARGIN_HOURS = 1;

export const expandRangeByRetentionMargin = (
  range: DateRange,
  marginHours = DEFAULT_RECORDING_RETENTION_MARGIN_HOURS,
): DateRange => {
  return {
    start: sub(range.start, { hours: marginHours }),
    end: add(range.end, { hours: marginHours }),
  };
};
