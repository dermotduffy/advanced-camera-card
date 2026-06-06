import { z } from 'zod';
import { stateBaseSchema } from '../../common/condition-trigger/state';
import { stringOrArray } from '../../common/string-or-array';
import { triggerBaseSchema } from '../base';
import { entityTriggerBaseSchema } from './entity-base';

// https://www.home-assistant.io/docs/automation/trigger/#state-trigger
export const stateTriggerSchema = entityTriggerBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend(stateBaseSchema.shape)
  .extend({
    trigger: z.literal('state'),

    // HA accepts `null` here, distinct from omitting the key: `null` matches
    // any state value, but specifying it (vs. omitting all of from/to/not_*)
    // restricts firing to real state changes rather than potentially
    // attribute-only changes.
    from: stringOrArray.nullable().optional(),
    to: stringOrArray.nullable().optional(),
    not_from: stringOrArray.nullable().optional(),
    not_to: stringOrArray.nullable().optional(),
  })
  // HA makes `from`/`not_from` and `to`/`not_to` mutually exclusive (vol.Exclusive).
  .refine(
    (data) => !(data.from !== undefined && data.not_from !== undefined),
    '`from` and `not_from` are mutually exclusive',
  )
  .refine(
    (data) => !(data.to !== undefined && data.not_to !== undefined),
    '`to` and `not_to` are mutually exclusive',
  );
