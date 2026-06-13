import { z } from 'zod';
import { cameraBaseSchema } from '../../common/camera';
import { conditionBaseSchema } from '../base';

export const cameraConditionSchema = cameraBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('camera'),
  });
