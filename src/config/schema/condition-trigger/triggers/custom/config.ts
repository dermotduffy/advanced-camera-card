import { z } from 'zod';

import { configBaseSchema } from '../../common/config';
import { triggerBaseSchema } from '../base';

export const configTriggerSchema = configBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('config') });
