import { z } from 'zod';
import { microphoneBaseSchema } from '../../common/microphone';

export const microphoneConditionSchema = microphoneBaseSchema.extend({
  condition: z.literal('microphone'),
});
