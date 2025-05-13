import { z } from 'zod';
import { actionsSchema } from './actions/types';
import {
  thumbnailControlsDefaults,
  thumbnailsControlBaseSchema,
} from './common/controls/thumbnails';

const folderGalleryThumbnailControlsDefaults = {
  ...thumbnailControlsDefaults,
  show_details: false,
};

export const folderGalleryConfigDefault = {
  controls: {
    thumbnails: folderGalleryThumbnailControlsDefaults,
  },
};

const folderGallerythumbnailsControlSchema = thumbnailsControlBaseSchema.extend({
  show_details: z.boolean().default(folderGalleryThumbnailControlsDefaults.show_details),
});

export const folderGalleryConfigSchema = z
  .object({
    controls: z
      .object({
        thumbnails: folderGallerythumbnailsControlSchema.default(
          folderGalleryConfigDefault.controls.thumbnails,
        ),
      })
      .default(folderGalleryConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(folderGalleryConfigDefault);
export type FolderGalleryConfig = z.infer<typeof folderGalleryConfigSchema>;
