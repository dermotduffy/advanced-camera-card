import { z } from 'zod';
import { actionsSchema } from './actions/types';
import {
  thumbnailControlsDefaults,
  thumbnailsControlBaseSchema,
} from './common/controls/thumbnails';

const mediaGalleryThumbnailControlsDefaults = {
  ...thumbnailControlsDefaults,
  show_details: false,
};

export const mediaGalleryConfigDefault = {
  controls: {
    thumbnails: mediaGalleryThumbnailControlsDefaults,
    filter: {
      mode: 'right' as const,
    },
  },
};

const mediaGallerythumbnailsControlSchema = thumbnailsControlBaseSchema.extend({
  show_details: z.boolean().default(mediaGalleryThumbnailControlsDefaults.show_details),
});
export type MediaGalleryThumbnailsConfig = z.infer<
  typeof mediaGallerythumbnailsControlSchema
>;

export const mediaGalleryConfigSchema = z
  .object({
    controls: z
      .object({
        thumbnails: mediaGallerythumbnailsControlSchema.default(
          mediaGalleryConfigDefault.controls.thumbnails,
        ),
        filter: z
          .object({
            mode: z
              .enum(['none', 'left', 'right'])
              .default(mediaGalleryConfigDefault.controls.filter.mode),
          })
          .default(mediaGalleryConfigDefault.controls.filter),
      })
      .default(mediaGalleryConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(mediaGalleryConfigDefault);
export type MediaGalleryConfig = z.infer<typeof mediaGalleryConfigSchema>;
