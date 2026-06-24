import { z } from 'zod';

import { interactionBaseSchema } from '../../common/interaction';
import { triggerBaseSchema } from '../base';

export const interactionTriggerSchema = interactionBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('interaction') });
