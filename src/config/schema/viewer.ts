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
import {
  MEDIA_ACTION_NEGATIVE_CONDITIONS,
  MEDIA_ACTION_POSITIVE_CONDITIONS,
} from './common/media-actions';
import { transitionEffectConfigSchema } from './common/transition-effect';

export const viewerConfigDefault = {
  auto_play: [...MEDIA_ACTION_POSITIVE_CONDITIONS],
  auto_pause: [...MEDIA_ACTION_NEGATIVE_CONDITIONS],
  auto_mute: [...MEDIA_ACTION_NEGATIVE_CONDITIONS],
  auto_unmute: [],
  lazy_load: true,
  draggable: true,
  zoomable: true,
  transition_effect: 'slide' as const,
  snapshot_click_plays_clip: true,
  display_mode: 'single' as const,
  controls: {
    builtin: true,
    next_previous: {
      size: 48,
      style: 'thumbnails' as const,
    },
    thumbnails: thumbnailControlsDefaults,
    timeline: miniTimelineConfigDefault,
    ptz: {
      ...ptzControlsDefaults,
      mode: 'off' as const,
    },
    wheel: true,
  },
};

const viewerNextPreviousControlConfigSchema = nextPreviousControlConfigSchema.extend({
  style: z
    .enum(['none', 'thumbnails', 'chevrons'])
    .default(viewerConfigDefault.controls.next_previous.style),
  size: nextPreviousControlConfigSchema.shape.size.default(
    viewerConfigDefault.controls.next_previous.size,
  ),
});

export const viewerConfigSchema = z
  .object({
    auto_play: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .array()
      .default(viewerConfigDefault.auto_play),
    auto_pause: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .array()
      .default(viewerConfigDefault.auto_pause),

    // Don't use MEDIA_UNMUTE_CONDITIONS and MEDIA_MUTE_CONDITIONS here, since
    // it includes 'microphone' which doesn't make sense for viewer media.
    auto_mute: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .array()
      .default(viewerConfigDefault.auto_mute),
    auto_unmute: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .array()
      .default(viewerConfigDefault.auto_unmute),
    lazy_load: z.boolean().default(viewerConfigDefault.lazy_load),
    draggable: z.boolean().default(viewerConfigDefault.draggable),
    zoomable: z.boolean().default(viewerConfigDefault.zoomable),
    transition_effect: transitionEffectConfigSchema.default(
      viewerConfigDefault.transition_effect,
    ),
    snapshot_click_plays_clip: z
      .boolean()
      .default(viewerConfigDefault.snapshot_click_plays_clip),
    display: viewDisplaySchema,
    controls: z
      .object({
        builtin: z.boolean().default(viewerConfigDefault.controls.builtin),
        next_previous: viewerNextPreviousControlConfigSchema.default(
          viewerConfigDefault.controls.next_previous,
        ),
        ptz: ptzControlsConfigSchema
          .extend({
            // The media_viewer ptz has no 'auto' mode.
            mode: z.enum(['off', 'on']).default(viewerConfigDefault.controls.ptz.mode),
          })
          .default(viewerConfigDefault.controls.ptz),
        thumbnails: thumbnailsControlSchema.default(
          viewerConfigDefault.controls.thumbnails,
        ),
        timeline: miniTimelineConfigSchema.default(
          viewerConfigDefault.controls.timeline,
        ),
        wheel: z.boolean().default(viewerConfigDefault.controls.wheel),
      })
      .default(viewerConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(viewerConfigDefault);
export type ViewerConfig = z.infer<typeof viewerConfigSchema>;
