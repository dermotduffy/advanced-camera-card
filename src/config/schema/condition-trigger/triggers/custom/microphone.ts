import { z } from 'zod';
import { microphoneBaseSchema } from '../../common/microphone';
import { triggerBaseSchema } from '../base';

export const microphoneTriggerSchema = microphoneBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('microphone') });
