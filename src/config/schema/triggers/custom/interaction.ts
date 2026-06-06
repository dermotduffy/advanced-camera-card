import { z } from 'zod';
import { interactionBaseSchema } from '../../common/condition-trigger/interaction';
import { triggerBaseSchema } from '../base';

export const interactionTriggerSchema = interactionBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('interaction') });
