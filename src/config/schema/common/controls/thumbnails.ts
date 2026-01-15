import { z } from 'zod';

// The min/max width thumbnail.
export const THUMBNAIL_WIDTH_MIN = 75;
export const THUMBNAIL_WIDTH_DEFAULT = 100;
export const THUMBNAIL_WIDTH_MAX = 300;

const thumbnailControlsBaseDefaults = {
  size: THUMBNAIL_WIDTH_DEFAULT,
  show_details: true,
  show_favorite_control: true,
  show_timeline_control: true,
  show_download_control: true,
  show_review_control: true,
  show_info_control: true,
};

// Configuration for the actual rendered thumbnail.
export const thumbnailsControlBaseSchema = z.object({
  size: z
    .number()
    .min(THUMBNAIL_WIDTH_MIN)
    .max(THUMBNAIL_WIDTH_MAX)
    .default(thumbnailControlsBaseDefaults.size),
  show_details: z.boolean().default(thumbnailControlsBaseDefaults.show_details),
  show_favorite_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_favorite_control),
  show_timeline_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_timeline_control),
  show_download_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_download_control),
  show_review_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_review_control),
  show_info_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_info_control),
});
export type ThumbnailsControlBaseConfig = z.infer<typeof thumbnailsControlBaseSchema>;

export const thumbnailControlsDefaults = {
  ...thumbnailControlsBaseDefaults,
  mode: 'right' as const,
};

export const thumbnailsControlSchema = thumbnailsControlBaseSchema.extend({
  mode: z
    .enum(['none', 'above', 'below', 'left', 'right'])
    .default(thumbnailControlsDefaults.mode),
});
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlSchema>;
