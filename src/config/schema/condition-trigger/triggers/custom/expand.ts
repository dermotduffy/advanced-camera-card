import { z } from 'zod';

import { expandBaseSchema } from '../../common/expand';
import { triggerBaseSchema } from '../base';

export const expandTriggerSchema = expandBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('expand') });
