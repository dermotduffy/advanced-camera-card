import { z } from 'zod';

// A Home Assistant time-period value (e.g. a condition/trigger `for:`), matching
// HA's `cv.time_period`: a number of seconds, an `HH:MM`/`HH:MM:SS` string, or a
// {days, hours, minutes, seconds, milliseconds} dict.
// https://www.home-assistant.io/docs/scripts/conditions/ (the `for` option)
export const timePeriodSchema = z.union([
  z.string(),
  z.number(),
  z.object({
    days: z.number().optional(),
    hours: z.number().optional(),
    minutes: z.number().optional(),
    seconds: z.number().optional(),
    milliseconds: z.number().optional(),
  }),
]);
export type TimePeriod = z.infer<typeof timePeriodSchema>;
