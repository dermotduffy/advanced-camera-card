import { format } from 'date-fns';

/**
 * Format a date object to RFC3339.
 * @param date A Date object.
 * @returns A date.
 */
export const formatISODate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};
