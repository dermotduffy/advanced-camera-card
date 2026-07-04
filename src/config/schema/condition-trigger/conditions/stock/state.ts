import { z } from 'zod';

import {
  checkStateMatchField,
  stateBaseSchema,
  stateMatchValueSchema,
} from '../../common/state';
import { conditionBaseSchema } from '../base';
import { entityConditionBaseSchema } from './entity-base';

// https://www.home-assistant.io/dashboards/conditional/#state
export const stateConditionSchema = entityConditionBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend(stateBaseSchema.shape)
  .extend({
    // If `condition` is omitted a state condition is assumed (picture-elements form).
    condition: z.literal('state').optional(),

    // Without `attribute` these are string/list state matchers (enforced by the
    // `superRefine` below); with `attribute` they compare raw against the
    // attribute value, so any type is accepted.
    //
    // `state` is common to both of Home Assistant's condition dialects;
    // `state_not` is only present in HA's picture-elements dialect (not the
    // automation dialect), but respected in both usecases in this card.
    // https://www.home-assistant.io/dashboards/picture-elements/#conditional-element
    state: stateMatchValueSchema,
    state_not: stateMatchValueSchema,

    // How a list of entities is combined: `all` (the default) requires every
    // entity to match, `any` requires at least one.
    // https://www.home-assistant.io/docs/scripts/conditions/#state-condition
    match: z.enum(['all', 'any']).optional(),
  })
  // A state condition is not useful without either `state` or `state_not` to
  // test against.
  .refine(
    (data) => data.state !== undefined || data.state_not !== undefined,
    'A `state` condition requires `state` or `state_not`',
  )
  // Without `attribute`, the match fields keep HA's string/list form.
  .superRefine((data, ctx) => {
    if (data.attribute !== undefined) {
      return;
    }
    checkStateMatchField(ctx, 'state', data.state, { nullable: false });
    checkStateMatchField(ctx, 'state_not', data.state_not, { nullable: false });
  });
