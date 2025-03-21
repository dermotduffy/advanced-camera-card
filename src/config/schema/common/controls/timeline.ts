import { z } from 'zod';
import { eventsMediaTypeSchema } from '../events-media';
import { thumbnailControlsDefaults } from './thumbnails';

const timelineCoreConfigDefault = {
  clustering_threshold: 3,
  events_media_type: 'all' as const,
  window_seconds: 60 * 60,
  show_recordings: true,
  style: 'stack' as const,
  pan_mode: 'pan' as const,
  format: {
    '24h': true,
  },
};

const timelinePanModeSchema = z.enum(['pan', 'seek', 'seek-in-media', 'seek-in-camera']);
export type TimelinePanMode = z.infer<typeof timelinePanModeSchema>;

const timelineFormatSchema = z.object({
  '24h': z.boolean().optional().default(timelineCoreConfigDefault.format['24h']),
});

export const timelineCoreConfigSchema = z.object({
  clustering_threshold: z
    .number()
    .optional()
    .default(timelineCoreConfigDefault.clustering_threshold),
  events_media_type: eventsMediaTypeSchema
    .optional()
    .default(timelineCoreConfigDefault.events_media_type),
  window_seconds: z
    .number()
    .min(1 * 60)
    .max(24 * 60 * 60)
    .optional()
    .default(timelineCoreConfigDefault.window_seconds),
  show_recordings: z
    .boolean()
    .optional()
    .default(timelineCoreConfigDefault.show_recordings),
  style: z.enum(['stack', 'ribbon']).optional().default(timelineCoreConfigDefault.style),
  pan_mode: timelinePanModeSchema.optional().default(timelineCoreConfigDefault.pan_mode),
  format: timelineFormatSchema.optional().default(timelineCoreConfigDefault.format),
});
export type TimelineCoreConfig = z.infer<typeof timelineCoreConfigSchema>;

export const miniTimelineConfigDefault = {
  ...timelineCoreConfigDefault,
  mode: 'none' as const,

  // Mini-timeline defaults to ribbon style.
  style: 'ribbon' as const,
};

export const miniTimelineConfigSchema = timelineCoreConfigSchema.extend({
  mode: z.enum(['none', 'above', 'below']).default(miniTimelineConfigDefault.mode),
  style: timelineCoreConfigSchema.shape.style.default(miniTimelineConfigDefault.style),
});
export type MiniTimelineControlConfig = z.infer<typeof miniTimelineConfigSchema>;

export const timelineConfigDefault = {
  ...timelineCoreConfigDefault,
  controls: {
    thumbnails: thumbnailControlsDefaults,
  },
};
