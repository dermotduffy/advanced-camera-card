import { z } from 'zod';
import { actionsSchema } from './actions/types';
import { nextPreviousControlConfigSchema } from './common/controls/next-previous';
import { ptzControlsConfigSchema, ptzControlsDefaults } from './common/controls/ptz';
import {
  thumbnailControlsDefaults,
  thumbnailsControlSchema,
} from './common/controls/thumbnails';
import {
  miniTimelineConfigDefault,
  miniTimelineConfigSchema,
} from './common/controls/timeline';
import { viewDisplaySchema } from './common/display';
import { eventsMediaTypeSchema } from './common/events-media';
import {
  MEDIA_ACTION_NEGATIVE_CONDITIONS,
  MEDIA_ACTION_POSITIVE_CONDITIONS,
  MEDIA_MUTE_CONDITIONS,
  MEDIA_UNMUTE_CONDITIONS,
} from './common/media-actions';
import { transitionEffectConfigSchema } from './common/transition-effect';

const microphoneConfigDefault = {
  always_connected: false,
  disconnect_seconds: 90,
  mute_after_microphone_mute_seconds: 60,
};

const microphoneConfigSchema = z
  .object({
    always_connected: z.boolean().default(microphoneConfigDefault.always_connected),
    disconnect_seconds: z
      .number()
      .min(0)
      .default(microphoneConfigDefault.disconnect_seconds),
    mute_after_microphone_mute_seconds: z
      .number()
      .min(0)
      .default(microphoneConfigDefault.mute_after_microphone_mute_seconds),
  })
  .default(microphoneConfigDefault);
export type MicrophoneConfig = z.infer<typeof microphoneConfigSchema>;

const liveThumbnailControlsDefaults = {
  ...thumbnailControlsDefaults,
  media_type: 'events' as const,
  events_media_type: 'all' as const,
};

export const liveConfigDefault = {
  auto_play: [...MEDIA_ACTION_POSITIVE_CONDITIONS],
  auto_pause: [],
  auto_mute: [...MEDIA_MUTE_CONDITIONS],
  auto_unmute: ['microphone' as const],
  preload: false,
  lazy_load: true,
  lazy_unload: [],
  draggable: true,
  zoomable: true,
  transition_effect: 'slide' as const,
  show_image_during_load: true,
  mode: 'single' as const,
  controls: {
    builtin: true,
    next_previous: {
      size: 48,
      style: 'chevrons' as const,
    },
    ptz: ptzControlsDefaults,
    thumbnails: liveThumbnailControlsDefaults,
    timeline: miniTimelineConfigDefault,
  },
  microphone: {
    ...microphoneConfigDefault,
  },
};

const livethumbnailsControlSchema = thumbnailsControlSchema.extend({
  media_type: z
    .enum(['events', 'recordings'])
    .default(liveConfigDefault.controls.thumbnails.media_type),
  events_media_type: eventsMediaTypeSchema.default(
    liveConfigDefault.controls.thumbnails.events_media_type,
  ),
});

export const liveConfigSchema = z
  .object({
    auto_pause: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .array()
      .default(liveConfigDefault.auto_pause),
    auto_play: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .array()
      .default(liveConfigDefault.auto_play),
    auto_mute: z
      .enum(MEDIA_MUTE_CONDITIONS)
      .array()
      .default(liveConfigDefault.auto_mute),
    auto_unmute: z
      .enum(MEDIA_UNMUTE_CONDITIONS)
      .array()
      .default(liveConfigDefault.auto_unmute),
    controls: z
      .object({
        builtin: z.boolean().default(liveConfigDefault.controls.builtin),
        next_previous: nextPreviousControlConfigSchema
          .extend({
            // Live cannot show thumbnails, remove that option.
            style: z
              .enum(['none', 'chevrons', 'icons'])
              .default(liveConfigDefault.controls.next_previous.style),
            size: nextPreviousControlConfigSchema.shape.size.default(
              liveConfigDefault.controls.next_previous.size,
            ),
          })
          .default(liveConfigDefault.controls.next_previous),
        ptz: ptzControlsConfigSchema.default(liveConfigDefault.controls.ptz),
        thumbnails: livethumbnailsControlSchema.default(
          liveConfigDefault.controls.thumbnails,
        ),
        timeline: miniTimelineConfigSchema.default(liveConfigDefault.controls.timeline),
      })
      .default(liveConfigDefault.controls),
    display: viewDisplaySchema,
    draggable: z.boolean().default(liveConfigDefault.draggable),
    lazy_load: z.boolean().default(liveConfigDefault.lazy_load),
    lazy_unload: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .array()
      .default(liveConfigDefault.lazy_unload),
    microphone: microphoneConfigSchema.default(liveConfigDefault.microphone),
    preload: z.boolean().default(liveConfigDefault.preload),
    show_image_during_load: z
      .boolean()
      .default(liveConfigDefault.show_image_during_load),
    transition_effect: transitionEffectConfigSchema.default(
      liveConfigDefault.transition_effect,
    ),
    zoomable: z.boolean().default(liveConfigDefault.zoomable),
  })
  .merge(actionsSchema)
  .default(liveConfigDefault);
export type LiveConfig = z.infer<typeof liveConfigSchema>;
