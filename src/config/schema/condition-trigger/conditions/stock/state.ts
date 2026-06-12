import { z } from 'zod';
import { stateBaseSchema } from '../../common/state';
import { stringOrArray } from '../../../common/string-or-array';
import { entityConditionBaseSchema } from './entity-base';

// https://www.home-assistant.io/dashboards/conditional/#state
export const stateConditionSchema = entityConditionBaseSchema
  .extend(stateBaseSchema.shape)
  .extend({
    // If `condition` is omitted a state condition is assumed (picture-elements form).
    condition: z.literal('state').optional(),

    // Common to both of Home Assistant's condition dialects:
    state: stringOrArray.optional(),

    // Only present in HA picture elements dialect (not automation dialect), but
    // respected in both usecases in this card.
    // https://www.home-assistant.io/dashboards/picture-elements/#conditional-element
    state_not: stringOrArray.optional(),

    // How a list of entities is combined: `all` (the default) requires every
    // entity to match, `any` requires at least one.
    // https://www.home-assistant.io/docs/scripts/conditions/#state-condition
    match: z.enum(['all', 'any']).optional(),
  })
  // HA requires `state` when `for` is set (key_dependency); `for` has no meaning
  // without a state to hold. The card also accepts `state_not` as that state.
  .refine(
    (data) =>
      data.for === undefined || data.state !== undefined || data.state_not !== undefined,
    '`for` requires `state` or `state_not`',
  );
