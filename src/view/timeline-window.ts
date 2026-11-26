import { add, differenceInSeconds, sub } from 'date-fns';

import type { DateRange } from '../utils/date/range';
import { convertRangeToCacheFriendlyTimes } from '../utils/date/range-to-cache-friendly';

/**
 * Get the window a timeline fetches media for: the window it shows, widened by
 * its own width on each side so that media is already there when it is panned.
 */
export const getTimelinePrefetchWindow = (window: DateRange): DateRange => {
  const width = differenceInSeconds(window.end, window.start);
  return {
    start: sub(window.start, { seconds: width }),
    end: add(window.end, { seconds: width }),
  };
};

/**
 * Get the time range of a timeline's query for the window it shows: its
 * prefetch window, rounded to times that make repeated queries cacheable.
 */
export const getTimelineQueryRange = (window: DateRange): DateRange =>
  convertRangeToCacheFriendlyTimes(getTimelinePrefetchWindow(window));
