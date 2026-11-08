import { z } from 'zod';

import { MEDIA_CHUNK_SIZE_DEFAULT } from '../../const';

// Where the card loading indicator shows: centered over the card (with its own
// background), or compact in a corner with the card's content visible behind it.
export const CARD_LOADING_INDICATOR_POSITIONS = [
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;
export type CardLoadingIndicatorPosition =
  (typeof CARD_LOADING_INDICATOR_POSITIONS)[number];

// The largest media fetch chunk size the configuration accepts.
export const MEDIA_CHUNK_SIZE_MAX = 1000;

export const performanceConfigDefault = {
  features: {
    animated_progress_indicator: true,
    card_loading_effects: true,
    card_loading_indicator: true,
    card_loading_indicator_position: 'center' as const,
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
        card_loading_effects: z
          .boolean()
          .default(performanceConfigDefault.features.card_loading_effects),
        card_loading_indicator: z
          .boolean()
          .default(performanceConfigDefault.features.card_loading_indicator),
        card_loading_indicator_position: z
          .enum(CARD_LOADING_INDICATOR_POSITIONS)
          .default(performanceConfigDefault.features.card_loading_indicator_position),
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
