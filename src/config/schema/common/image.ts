import { z } from 'zod';

export const imageConfigDefault = {
  mode: 'auto' as const,
  refresh_seconds: 1,
  zoomable: true,
};

const IMAGE_MODES = ['auto', 'camera', 'entity', 'screensaver', 'url'] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

export const imageBaseConfigSchema = z.object({
  mode: z.enum(IMAGE_MODES).default(imageConfigDefault.mode),

  refresh_seconds: z.number().min(0).default(imageConfigDefault.refresh_seconds),

  url: z.string().optional(),
  entity: z.string().optional(),
  entity_parameters: z.string().optional(),
});
