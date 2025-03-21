import { z } from 'zod';
import { thumbnailsControlSchema } from './common/controls/thumbnails';
import {
  timelineConfigDefault,
  timelineCoreConfigSchema,
} from './common/controls/timeline';

export const timelineConfigSchema = timelineCoreConfigSchema
  .extend({
    controls: z
      .object({
        thumbnails: thumbnailsControlSchema.default(
          timelineConfigDefault.controls.thumbnails,
        ),
      })
      .default(timelineConfigDefault.controls),
  })
  .default(timelineConfigDefault);
export type TimelineConfig = z.infer<typeof timelineConfigSchema>;
