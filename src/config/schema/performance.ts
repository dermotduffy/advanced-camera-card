import { z } from 'zod';
import { MEDIA_CHUNK_SIZE_DEFAULT, MEDIA_CHUNK_SIZE_MAX } from '../../const';

export const performanceConfigDefault = {
  features: {
    animated_progress_indicator: true,
    card_loading_indicator: true,
    media_chunk_size: MEDIA_CHUNK_SIZE_DEFAULT,
  },
  style: {
    border_radius: true,
    box_shadow: true,
  },
};

export const performanceConfigSchema = z
  .object({
    features: z
      .object({
        animated_progress_indicator: z
          .boolean()
          .default(performanceConfigDefault.features.animated_progress_indicator),
        card_loading_indicator: z
          .boolean()
          .default(performanceConfigDefault.features.card_loading_indicator),
        media_chunk_size: z
          .number()
          .min(0)
          .max(MEDIA_CHUNK_SIZE_MAX)
          .default(performanceConfigDefault.features.media_chunk_size),
        max_simultaneous_engine_requests: z.number().min(1).optional(),
      })
      .default(performanceConfigDefault.features),
    style: z
      .object({
        border_radius: z.boolean().default(performanceConfigDefault.style.border_radius),
        box_shadow: z.boolean().default(performanceConfigDefault.style.box_shadow),
      })
      .default(performanceConfigDefault.style),
  })
  .default(performanceConfigDefault);
export type PerformanceConfig = z.infer<typeof performanceConfigSchema>;
