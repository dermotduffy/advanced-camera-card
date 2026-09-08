import { z } from 'zod';

import {
  thumbnailsControlDefaults,
  thumbnailsControlSchema,
} from './common/controls/thumbnails';
import {
  timelineCoreConfigDefault,
  timelineCoreConfigSchema,
} from './common/controls/timeline';

export const timelineConfigDefault = {
  ...timelineCoreConfigDefault,
  controls: {
    thumbnails: thumbnailsControlDefaults,
  },
};

export const timelineConfigSchema = timelineCoreConfigSchema
  .extend({
    controls: z
      .object({
        thumbnails: thumbnailsControlSchema.default(thumbnailsControlDefaults),
      })
      .default(timelineConfigDefault.controls),
  })
  .default(timelineConfigDefault);
export type TimelineConfig = z.infer<typeof timelineConfigSchema>;
