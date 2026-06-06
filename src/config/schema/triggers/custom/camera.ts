import { z } from 'zod';
import { cameraBaseSchema } from '../../common/condition-trigger/camera';
import { triggerBaseSchema } from '../base';

export const cameraTriggerSchema = cameraBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('camera') });
