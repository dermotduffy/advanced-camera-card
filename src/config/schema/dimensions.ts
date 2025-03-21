import { z } from 'zod';
import { aspectRatioSchema } from './common/aspect-ratio';

const dimensionsConfigDefault = {
  aspect_ratio_mode: 'dynamic' as const,
  aspect_ratio: [16, 9],
  height: 'auto',
};

export const dimensionsConfigSchema = z
  .object({
    aspect_ratio_mode: z
      .enum(['dynamic', 'static', 'unconstrained'])
      .default(dimensionsConfigDefault.aspect_ratio_mode),
    aspect_ratio: aspectRatioSchema.default(dimensionsConfigDefault.aspect_ratio),
    height: z.string().default(dimensionsConfigDefault.height),
  })
  .default(dimensionsConfigDefault);
