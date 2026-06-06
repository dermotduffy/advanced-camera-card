import { z } from 'zod';
import { mediaLoadedBaseSchema } from '../../common/condition-trigger/media-loaded';
import { triggerBaseSchema } from '../base';

export const mediaLoadedTriggerSchema = mediaLoadedBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('media_loaded') });
