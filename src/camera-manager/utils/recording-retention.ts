import { add, sub } from 'date-fns';

import type { DateRange } from '../range';

// Frigate buckets recordings by the hour. Keeping one hour on either side of
// the requested window means panning back across the hour just left is still
// a cache hit, and anything further away can be dropped.
export const RECORDING_RETENTION_MARGIN_HOURS = 1;

export const expandRangeByRetentionMargin = (range: DateRange): DateRange => {
  return {
    start: sub(range.start, { hours: RECORDING_RETENTION_MARGIN_HOURS }),
    end: add(range.end, { hours: RECORDING_RETENTION_MARGIN_HOURS }),
  };
};
