import { z } from 'zod';

// A Home Assistant time-period value (e.g. a condition/trigger `for:`),
// matching HA's `cv.positive_time_period_template`: a number of seconds, an
// `HH:MM`/ `HH:MM:SS` string, or a {days, hours, minutes, seconds,
// milliseconds} dict. The whole value, or any individual dict field, may be a
// template string rendered at evaluation time (e.g. `minutes: "{{
// states('input_number.delay') | int }}"`).
// https://www.home-assistant.io/docs/scripts/conditions/ (the `for` option)
const numberOrTemplate = z.number().or(z.string());
export const timePeriodSchema = z.union([
  z.string(),
  z.number(),
  z.object({
    days: numberOrTemplate.optional(),
    hours: numberOrTemplate.optional(),
    minutes: numberOrTemplate.optional(),
    seconds: numberOrTemplate.optional(),
    milliseconds: numberOrTemplate.optional(),
  }),
]);
export type TimePeriod = z.infer<typeof timePeriodSchema>;
