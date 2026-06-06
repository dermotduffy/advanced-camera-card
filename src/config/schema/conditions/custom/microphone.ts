import { z } from 'zod';
import { microphoneBaseSchema } from '../../common/condition-trigger/microphone';

export const microphoneConditionSchema = microphoneBaseSchema.extend({
  condition: z.literal('microphone'),
});
