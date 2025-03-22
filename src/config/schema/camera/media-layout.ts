import { z } from 'zod';
import { panSchema } from '../common/pan';
import { zoomSchema } from '../common/zoom';

export const mediaLayoutConfigSchema = z.object({
  fit: z.enum(['contain', 'cover', 'fill']).optional(),
  position: z
    .object({
      x: z.number().min(0).max(100).optional(),
      y: z.number().min(0).max(100).optional(),
    })
    .optional(),
  view_box: z
    .object({
      bottom: z.number().min(0).max(100).optional().default(0),
      left: z.number().min(0).max(100).optional().default(0),
      right: z.number().min(0).max(100).optional().default(0),
      top: z.number().min(0).max(100).optional().default(0),
    })
    .optional(),
  pan: panSchema.optional(),
  zoom: zoomSchema.optional(),
});
export type MediaLayoutConfig = z.infer<typeof mediaLayoutConfigSchema>;
