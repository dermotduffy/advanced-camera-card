import { z } from 'zod';
import { AUTO_HIDE_CONDITIONS } from '../auto-hide';
import { BUTTON_SIZE_MIN } from '../const';

export const nextPreviousControlConfigSchema = z.object({
  auto_hide: z.enum(AUTO_HIDE_CONDITIONS).array(),
  style: z.enum(['none', 'chevrons', 'icons', 'thumbnails']),
  size: z.number().min(BUTTON_SIZE_MIN),
});
export type NextPreviousControlConfig = z.infer<typeof nextPreviousControlConfigSchema>;
