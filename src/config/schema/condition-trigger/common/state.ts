import { z } from 'zod';

import { forwardIssues } from '../../../../utils/zod/forward-issues';
import { stringOrArray } from '../../common/string-or-array';
import { timePeriodSchema } from '../../common/time-period';

// Fields shared by the `state` condition AND trigger.
export const stateBaseSchema = z.object({
  // Match against an entity attribute instead of its state.
  attribute: z.string().optional(),

  // the match must hold for at least this time period.
  for: timePeriodSchema.optional(),
});

// A state-match field (`from`/`to`/`state`/`state_not`/...). It accepts any
// JSON value because, when `attribute` is set, Home Assistant compares the raw
// attribute value against the configured value with Python `==` (any type is
// valid). When `attribute` is unset the value is restricted back to a string or
// list of strings by `checkStateMatchField`.
export const stateMatchValueSchema = z.unknown().optional();

// When `attribute` is unset, Home Assistant keeps a state-match field
// restricted to a string or list of strings; the widened
// `stateMatchValueSchema` skips that check, so re-apply the original schema
// here. `nullable` covers the trigger's `null` "match any" sentinel; conditions
// pass `false`.
export const checkStateMatchField = (
  ctx: z.RefinementCtx,
  field: string,
  value: unknown,
  { nullable }: { nullable: boolean },
): void => {
  if (value === undefined) {
    return;
  }
  forwardIssues(ctx, value, nullable ? stringOrArray.nullable() : stringOrArray, [
    field,
  ]);
};
