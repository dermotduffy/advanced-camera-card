import { z } from 'zod';

export const viewDisplayModeSchema = z.enum(['single', 'grid']);
export type ViewDisplayMode = z.infer<typeof viewDisplayModeSchema>;

export const viewDisplaySchema = z
  .object({
    mode: viewDisplayModeSchema.optional(),
    grid_selected_width_factor: z.number().min(0).optional(),
    grid_max_columns: z.number().min(0).optional(),
    grid_columns: z.number().min(0).optional(),
  })
  .optional();
export type ViewDisplayConfig = z.infer<typeof viewDisplaySchema>;
