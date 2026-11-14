import { z } from 'zod';

export const imageBaseConfigDefault = {
  last_frame: {
    max_age_seconds: 86400,
    show_time: true,
  },
  mode: 'auto' as const,
  refresh_seconds: 'auto' as const,
};

const IMAGE_MODES = [
  'auto',
  'camera',
  'default',
  'entity',
  'last_frame',
  'screensaver',
  'url',
] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

const lastFrameConfigSchema = z.object({
  // A captured frame older than this is no longer shown (nor kept).
  max_age_seconds: z
    .number()
    .min(1)
    .default(imageBaseConfigDefault.last_frame.max_age_seconds),
  show_time: z.boolean().default(imageBaseConfigDefault.last_frame.show_time),
});

export const imageBaseConfigSchema = z.object({
  mode: z.enum(IMAGE_MODES).default(imageBaseConfigDefault.mode),

  refresh_seconds: z
    .union([z.literal('auto'), z.number().min(0)])
    .default(imageBaseConfigDefault.refresh_seconds),

  last_frame: lastFrameConfigSchema.default(imageBaseConfigDefault.last_frame),

  url: z.string().optional(),
  entity: z.string().optional(),
  entity_parameters: z.string().optional(),
});

export type ImageBaseConfig = z.infer<typeof imageBaseConfigSchema>;
