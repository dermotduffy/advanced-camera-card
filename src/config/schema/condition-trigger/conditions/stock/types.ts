import { z } from 'zod';

import { numericStateConditionSchema } from './numeric-state';
import { screenConditionSchema } from './screen';
import { stateConditionSchema } from './state';
import { userConditionSchema } from './user';

export const stockConditionSchema = z.discriminatedUnion('condition', [
  stateConditionSchema,
  numericStateConditionSchema,
  screenConditionSchema,
  userConditionSchema,
]);
