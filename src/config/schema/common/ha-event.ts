import { z } from 'zod';

import { stringOrArray } from './string-or-array';

// Filter on the event's `context` (HA's three fixed fields). Each defined field
// is equality-matched against a scalar or membership-matched against a list.
// `.strict()` rejects unknown keys at parse time so a typo (e.g. `user:` vs
// `user_id:`) surfaces instead of silently collapsing to "match everything".
const eventContextFilterSchema = z
  .object({
    id: stringOrArray.optional(),
    user_id: stringOrArray.optional(),
    parent_id: stringOrArray.optional(),
  })
  .strict();
export type HAEventContextFilter = z.infer<typeof eventContextFilterSchema>;

// A Home Assistant bus event filter: `event_type` (one type, or a list to match
// any of them) plus optional payload (`event_data`) and context (`context`)
// filters. `event_data` mirrors HA's matching exactly: listed keys (top-level
// and nested) must be present and extra keys are ignored -- see `event-match.ts`
// for the precise nested-object/array semantics. `context` is field-level
// equality or list-membership. Field names mirror HA's native event trigger
// exactly so the same YAML works in either place.
// https://www.home-assistant.io/docs/automation/trigger/#event-trigger
export const haEventSchema = z.object({
  event_type: stringOrArray,
  event_data: z.record(z.string(), z.unknown()).optional(),
  context: eventContextFilterSchema.optional(),
});
export type HAEvent = z.infer<typeof haEventSchema>;
