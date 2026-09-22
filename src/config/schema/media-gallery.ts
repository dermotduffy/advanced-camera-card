import { z } from 'zod';

import { actionsSchema } from './actions/types';
import {
  thumbnailsControlBaseDefaults,
  thumbnailsControlBaseSchema,
} from './common/controls/thumbnails';

export const mediaGalleryConfigDefault = {
  controls: {
    thumbnails: thumbnailsControlBaseDefaults,
    filter: {
      mode: 'right' as const,
    },
  },
};

export const mediaGalleryConfigSchema = z
  .object({
    controls: z
      .object({
        thumbnails: thumbnailsControlBaseSchema.default(
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
  .extend(actionsSchema.shape)
  .default(mediaGalleryConfigDefault);
export type MediaGalleryConfig = z.infer<typeof mediaGalleryConfigSchema>;
