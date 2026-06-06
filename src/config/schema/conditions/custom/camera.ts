import { z } from 'zod';
import { cameraBaseSchema } from '../../common/condition-trigger/camera';

export const cameraConditionSchema = cameraBaseSchema.extend({
  condition: z.literal('camera'),
});
