import { z } from 'zod';
import {
  thumbnailControlsDefaults,
  thumbnailsControlSchema,
} from './common/controls/thumbnails';
import {
  timelineCoreConfigDefault,
  timelineCoreConfigSchema,
} from './common/controls/timeline';
import { eventsMediaTypeSchema } from './common/events-media';

const timelineThumbnailsControlDefault = {
  ...thumbnailControlsDefaults,
  media_type: 'auto' as const,
  events_media_type: 'all' as const,
};

// Differs from live equivalent (schema/live.ts) in that recordings are not
// supported as the main media.
const timelineMediaTypeSchema = z.enum(['auto', 'events', 'reviews']);

const timelineThumbnailsControlSchema = thumbnailsControlSchema.extend({
  media_type: timelineMediaTypeSchema.default(
    timelineThumbnailsControlDefault.media_type,
  ),
  events_media_type: eventsMediaTypeSchema.default(
    timelineThumbnailsControlDefault.events_media_type,
  ),
});
export type TimelineThumbnailsControlConfig = z.infer<
  typeof timelineThumbnailsControlSchema
>;

export const timelineConfigDefault = {
  ...timelineCoreConfigDefault,
  controls: {
    thumbnails: timelineThumbnailsControlDefault,
  },
};

export const timelineConfigSchema = timelineCoreConfigSchema
  .extend({
    controls: z
      .object({
        thumbnails: timelineThumbnailsControlSchema.default(
          timelineThumbnailsControlDefault,
        ),
      })
      .default(timelineConfigDefault.controls),
  })
  .default(timelineConfigDefault);
export type TimelineConfig = z.infer<typeof timelineConfigSchema>;
