import { z } from 'zod';

import {
  checkStateMatchField,
  stateBaseSchema,
  stateMatchValueSchema,
} from '../../common/state';
import { triggerBaseSchema } from '../base';
import { entityTriggerBaseSchema } from './entity-base';

// https://www.home-assistant.io/docs/automation/trigger/#state-trigger
export const stateTriggerSchema = entityTriggerBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend(stateBaseSchema.shape)
  .extend({
    trigger: z.literal('state'),

    // Without `attribute` these are string/list state matchers (enforced by the
    // `superRefine` below); with `attribute` they compare raw against the
    // attribute value, so any type is accepted. HA also accepts `null` here,
    // distinct from omitting the key: `null` matches any state value, but
    // specifying it (vs. omitting all of from/to/not_*) restricts firing to real
    // state changes rather than potentially attribute-only changes.
    from: stateMatchValueSchema,
    to: stateMatchValueSchema,
    not_from: stateMatchValueSchema,
    not_to: stateMatchValueSchema,
  })
  // HA makes `from`/`not_from` and `to`/`not_to` mutually exclusive (vol.Exclusive).
  .refine(
    (data) => !(data.from !== undefined && data.not_from !== undefined),
    '`from` and `not_from` are mutually exclusive',
  )
  .refine(
    (data) => !(data.to !== undefined && data.not_to !== undefined),
    '`to` and `not_to` are mutually exclusive',
  )
  // Without `attribute`, the match fields keep HA's string/list form.
  .superRefine((data, ctx) => {
    if (data.attribute !== undefined) {
      return;
    }
    checkStateMatchField(ctx, 'from', data.from, { nullable: true });
    checkStateMatchField(ctx, 'to', data.to, { nullable: true });
    checkStateMatchField(ctx, 'not_from', data.not_from, { nullable: true });
    checkStateMatchField(ctx, 'not_to', data.not_to, { nullable: true });
  });
