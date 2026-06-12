import { z } from 'zod';
import { cameraBaseSchema } from '../../common/camera';

export const cameraConditionSchema = cameraBaseSchema.extend({
  condition: z.literal('camera'),
});
