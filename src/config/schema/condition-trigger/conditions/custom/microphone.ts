import { z } from 'zod';

import { microphoneBaseSchema } from '../../common/microphone';
import { conditionBaseSchema } from '../base';

export const microphoneConditionSchema = microphoneBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('microphone'),
    muted: z.boolean(),
  });
