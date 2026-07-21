import { z } from 'zod';

export const timelineCoreConfigDefault = {
  clustering_threshold: 3,
  window_seconds: 60 * 60,
  show_recordings: true,
  style: 'stack' as const,
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
  format: timelineFormatSchema.optional().default(timelineCoreConfigDefault.format),
});
type TimelineCoreConfig = z.infer<typeof timelineCoreConfigSchema>;

export const miniTimelineConfigDefault = {
  ...timelineCoreConfigDefault,
  mode: 'none' as const,

  // The non-`pan` modes seek within playing media, so `pan_mode` only applies
  // to a mini timeline shown alongside media.
  pan_mode: 'pan' as const,

  // Mini-timeline defaults to ribbon style.
  style: 'ribbon' as const,
};

export const miniTimelineConfigSchema = timelineCoreConfigSchema.extend({
  mode: z.enum(['none', 'above', 'below']).default(miniTimelineConfigDefault.mode),
  pan_mode: timelinePanModeSchema.optional().default(miniTimelineConfigDefault.pan_mode),
  style: timelineCoreConfigSchema.shape.style.default(miniTimelineConfigDefault.style),
});
export type MiniTimelineControlConfig = z.infer<typeof miniTimelineConfigSchema>;

// The config consumed by the shared `timeline-core` component: the core fields,
// plus the mini-only extras (`pan_mode` etc.) made optional since the full
// timeline omits them.
export type TimelineCoreComponentConfig = TimelineCoreConfig &
  Partial<MiniTimelineControlConfig>;
