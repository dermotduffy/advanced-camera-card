import { z } from 'zod';
import { hasAboveOrBelow, numericStateBaseSchema } from '../../common/numeric-state';
import { conditionBaseSchema } from '../base';
import { entityConditionBaseSchema } from './entity-base';

// https://www.home-assistant.io/dashboards/conditional/#numeric-state
export const numericStateConditionSchema = entityConditionBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend(numericStateBaseSchema.shape)
  .extend({ condition: z.literal('numeric_state') })
  .refine(
    hasAboveOrBelow,
    'A numeric_state condition requires at least one of `above`/`below`',
  );
