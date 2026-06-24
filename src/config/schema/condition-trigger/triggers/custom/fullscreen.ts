import { z } from 'zod';

import { fullscreenBaseSchema } from '../../common/fullscreen';
import { triggerBaseSchema } from '../base';

export const fullscreenTriggerSchema = fullscreenBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('fullscreen') });
