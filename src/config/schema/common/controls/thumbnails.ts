import { z } from 'zod';

export const THUMBNAIL_SIZE_MIN = 75;
export const THUMBNAIL_SIZE_DEFAULT = 100;
export const THUMBNAIL_SIZE_MAX = 300;

const thumbnailDetailsStyleSchema = z.enum([
  'auto',
  'none',
  'overlay',
  'hover',
  'panel',
]);
export type ThumbnailDetailsStyle = z.infer<typeof thumbnailDetailsStyleSchema>;

export const thumbnailsControlBaseDefaults = {
  size: THUMBNAIL_SIZE_DEFAULT,
  details_style: 'auto' as const,
  show_favorite_control: true,
  show_timeline_control: false,
  show_download_control: false,
  show_review_control: true,
  show_info_control: true,
};

// Configuration for the actual rendered thumbnail.
export const thumbnailsControlBaseSchema = z.object({
  size: z
    .number()
    .min(THUMBNAIL_SIZE_MIN)
    .max(THUMBNAIL_SIZE_MAX)
    .default(thumbnailsControlBaseDefaults.size),
  details_style: thumbnailDetailsStyleSchema.default(
    thumbnailsControlBaseDefaults.details_style,
  ),
  show_favorite_control: z
    .boolean()
    .default(thumbnailsControlBaseDefaults.show_favorite_control),
  show_timeline_control: z
    .boolean()
    .default(thumbnailsControlBaseDefaults.show_timeline_control),
  show_download_control: z
    .boolean()
    .default(thumbnailsControlBaseDefaults.show_download_control),
  show_review_control: z
    .boolean()
    .default(thumbnailsControlBaseDefaults.show_review_control),
  show_info_control: z
    .boolean()
    .default(thumbnailsControlBaseDefaults.show_info_control),
});
export type ThumbnailsControlBaseConfig = z.infer<typeof thumbnailsControlBaseSchema>;

export const thumbnailsControlDefaults = {
  ...thumbnailsControlBaseDefaults,
  mode: 'right' as const,
};

export const thumbnailsControlSchema = thumbnailsControlBaseSchema.extend({
  mode: z
    .enum(['none', 'above', 'below', 'left', 'right'])
    .default(thumbnailsControlDefaults.mode),
});
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlSchema>;
