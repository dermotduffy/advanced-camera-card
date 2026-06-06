import { z } from 'zod';
import { triggeredBaseSchema } from '../../common/condition-trigger/triggered';
import { triggerBaseSchema } from '../base';

export const triggeredTriggerSchema = triggeredBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('triggered') });
