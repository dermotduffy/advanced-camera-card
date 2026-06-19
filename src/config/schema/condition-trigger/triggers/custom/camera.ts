import { z } from 'zod';
import { cameraBaseSchema } from '../../common/camera';
import { triggerBaseSchema } from '../base';

export const cameraTriggerSchema = cameraBaseSchema
  .extend(triggerBaseSchema.shape)
  .extend({ trigger: z.literal('camera') });
