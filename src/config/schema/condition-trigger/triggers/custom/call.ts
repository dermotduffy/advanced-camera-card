import { z } from 'zod';
import { callBaseSchema } from '../../common/call';
import { triggerBaseSchema } from '../base';

export const callTriggerSchema = callBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('call') });
