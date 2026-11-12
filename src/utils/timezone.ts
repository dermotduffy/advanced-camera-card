import { addHours, subMilliseconds } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export interface DayHour {
  // A 'YYYY-MM-DD' string.
  day: string;

  hour: number;
}

/**
 * Create a function that resolves dates to the calendar day and hour they fall
 * on in a given timezone. Constructing the underlying formatter costs 13x what
 * *using* one does, so callers that resolve many dates should create one
 * resolver and reuse it.
 */
export const createDayHourResolver = (timeZone: string): ((date: Date) => DayHour) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });

  return (date: Date): DayHour => {
    const parts = formatter.formatToParts(date);

    /* v8 ignore next 2: Intl always emits every requested part, so the fallback
       is unreachable -- @preserve */
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '';

    return {
      day: `${get('year')}-${get('month')}-${get('day')}`,
      hour: Number(get('hour')),
    };
  };
};

export const getDayHourInTimeZone = (date: Date, timeZone: string): DayHour =>
  createDayHourResolver(timeZone)(date);

/**
 * @param day A 'YYYY-MM-DD' string.
 */
export const hourInTimeZoneToDate = (
  day: string,
  hour: number,
  timeZone: string,
): Date => fromZonedTime(`${day}T${String(hour).padStart(2, '0')}:00:00`, timeZone);

export const startOfHourInTimeZone = (date: Date, timeZone: string): Date => {
  const { day, hour } = getDayHourInTimeZone(date, timeZone);
  return hourInTimeZoneToDate(day, hour, timeZone);
};

export const endOfHourInTimeZone = (date: Date, timeZone: string): Date =>
  subMilliseconds(addHours(startOfHourInTimeZone(date, timeZone), 1), 1);
