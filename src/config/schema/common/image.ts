import { z } from 'zod';

export const imageBaseConfigDefault = {
  mode: 'auto' as const,
  refresh_seconds: 'auto' as const,
};

const IMAGE_MODES = [
  'auto',
  'camera',
  'default',
  'entity',
  'screensaver',
  'url',
] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

export const imageBaseConfigSchema = z.object({
  mode: z.enum(IMAGE_MODES).default(imageBaseConfigDefault.mode),

  refresh_seconds: z
    .union([z.literal('auto'), z.number().min(0)])
    .default(imageBaseConfigDefault.refresh_seconds),

  url: z.string().optional(),
  entity: z.string().optional(),
  entity_parameters: z.string().optional(),
});

export type ImageBaseConfig = z.infer<typeof imageBaseConfigSchema>;
