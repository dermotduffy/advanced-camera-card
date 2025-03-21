import { z } from 'zod';
import { actionsSchema } from './actions/types';
import { imageBaseConfigSchema, imageConfigDefault } from './common/image';

export const imageConfigSchema = imageBaseConfigSchema
  .extend({
    zoomable: z.boolean().default(imageConfigDefault.zoomable),
  })
  .merge(actionsSchema)
  .default(imageConfigDefault);

export type ImageViewConfig = z.infer<typeof imageConfigSchema>;
