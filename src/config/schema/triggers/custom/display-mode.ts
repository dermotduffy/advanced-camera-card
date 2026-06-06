import { z } from 'zod';
import { displayModeBaseSchema } from '../../common/condition-trigger/display-mode';
import { triggerBaseSchema } from '../base';

export const displayModeTriggerSchema = displayModeBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('display_mode') });
