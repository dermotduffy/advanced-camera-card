import { z } from 'zod';

import { DEFAULT_RECORDING_RETENTION_MARGIN_HOURS } from '../../camera-manager/utils/recording-retention';
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
  recording_retention_hours: DEFAULT_RECORDING_RETENTION_MARGIN_HOURS,
  controls: {
    thumbnails: thumbnailsControlDefaults,
  },
};

export const timelineConfigSchema = timelineCoreConfigSchema
  .extend({
    // Hours of recording data kept on either side of the visible window.
    // Shared by the timeline and the Frigate segment cache.
    recording_retention_hours: z
      .number()
      .min(0)
      .max(24)
      .optional()
      .default(timelineConfigDefault.recording_retention_hours),
    controls: z
      .object({
        thumbnails: thumbnailsControlSchema.default(thumbnailsControlDefaults),
      })
      .default(timelineConfigDefault.controls),
  })
  .default(timelineConfigDefault);
export type TimelineConfig = z.infer<typeof timelineConfigSchema>;
