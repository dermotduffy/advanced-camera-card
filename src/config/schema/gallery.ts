import { z } from 'zod';
import { actionsSchema } from './actions/types';
import {
  thumbnailControlsDefaults,
  thumbnailsControlSchema,
} from './common/controls/thumbnails';

const galleryThumbnailControlsDefaults = {
  ...thumbnailControlsDefaults,
  show_details: false,
};

export const galleryConfigDefault = {
  controls: {
    thumbnails: galleryThumbnailControlsDefaults,
    filter: {
      mode: 'right' as const,
    },
  },
};

const gallerythumbnailsControlSchema = thumbnailsControlSchema.extend({
  show_details: z.boolean().default(galleryThumbnailControlsDefaults.show_details),
});

export const galleryConfigSchema = z
  .object({
    controls: z
      .object({
        thumbnails: gallerythumbnailsControlSchema.default(
          galleryConfigDefault.controls.thumbnails,
        ),
        filter: z
          .object({
            mode: z
              .enum(['none', 'left', 'right'])
              .default(galleryConfigDefault.controls.filter.mode),
          })
          .default(galleryConfigDefault.controls.filter),
      })
      .default(galleryConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(galleryConfigDefault);
export type GalleryConfig = z.infer<typeof galleryConfigSchema>;
