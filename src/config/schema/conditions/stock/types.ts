import { z } from 'zod';
import { numericStateConditionSchema } from './numeric';
import { screenConditionSchema } from './screen';
import { stateConditionSchema } from './state';
import { usersConditionSchema } from './users';

export const stockConditionSchema = z.discriminatedUnion('condition', [
  stateConditionSchema,
  numericStateConditionSchema,
  screenConditionSchema,
  usersConditionSchema,
]);
export type StockCondition = z.infer<typeof stockConditionSchema>;
