import { z } from 'zod';
import { AUTO_HIDE_CONDITIONS } from './common/auto-hide';
import { BUTTON_SIZE_MIN, MENU_PRIORITY_DEFAULT } from './common/const';
import { menuBaseSchema } from './elements/custom/menu/base';

const MENU_STYLES = [
  'none',
  'hidden',
  'overlay',
  'hover',
  'hover-card',
  'outside',
] as const;
const MENU_POSITIONS = ['left', 'right', 'top', 'bottom'] as const;
const MENU_ALIGNMENTS = MENU_POSITIONS;

const baseButtonDefault = {
  alignment: 'matching' as const,
  state_color: true,
  permanent: false,
  priority: MENU_PRIORITY_DEFAULT,
};

const visibleButtonDefault = {
  ...baseButtonDefault,
  enabled: true,
};

const hiddenButtonDefault = {
  ...baseButtonDefault,
  enabled: false,
};

export const menuConfigDefault = {
  alignment: 'left' as const,
  auto_hide: ['call' as const, 'casting' as const],
  button_size: 40,
  buttons: {
    // Clone per key so each button has its own default object. This avoids
    // shared nested default references between keys.
    call: { ...visibleButtonDefault },
    camera_ui: { ...visibleButtonDefault },
    cameras: { ...visibleButtonDefault },
    clips: { ...hiddenButtonDefault },
    ptz_home: { ...hiddenButtonDefault },
    display_mode: { ...visibleButtonDefault },
    download: { ...visibleButtonDefault },
    expand: { ...hiddenButtonDefault },
    folders: { ...visibleButtonDefault },
    iris: { ...visibleButtonDefault },
    fullscreen: { ...visibleButtonDefault },
    image: { ...hiddenButtonDefault },
    info: { ...visibleButtonDefault },
    gallery: { ...visibleButtonDefault },
    live: { ...visibleButtonDefault },
    media_player: { ...visibleButtonDefault },
    microphone: {
      ...hiddenButtonDefault,
      type: 'momentary' as const,
    },
    mute: { ...hiddenButtonDefault },
    pip: { ...hiddenButtonDefault },
    play: { ...hiddenButtonDefault },
    ptz_controls: { ...hiddenButtonDefault },
    recordings: { ...hiddenButtonDefault },
    reviews: { ...hiddenButtonDefault },
    set_review: { ...visibleButtonDefault },
    screenshot: { ...hiddenButtonDefault },
    snapshots: { ...hiddenButtonDefault },
    substreams: { ...visibleButtonDefault },
    timeline: { ...visibleButtonDefault },
  },
  position: 'top' as const,
  style: 'hidden' as const,
};

const visibleButtonSchema = menuBaseSchema.extend({
  enabled: menuBaseSchema.shape.enabled.default(visibleButtonDefault.enabled),
  priority: menuBaseSchema.shape.priority.default(visibleButtonDefault.priority),
});

const hiddenButtonSchema = menuBaseSchema.extend({
  enabled: menuBaseSchema.shape.enabled.default(hiddenButtonDefault.enabled),
  priority: menuBaseSchema.shape.priority.default(hiddenButtonDefault.priority),
});

export const menuConfigSchema = z
  .object({
    style: z.enum(MENU_STYLES).default(menuConfigDefault.style),
    position: z.enum(MENU_POSITIONS).default(menuConfigDefault.position),
    alignment: z.enum(MENU_ALIGNMENTS).default(menuConfigDefault.alignment),
    auto_hide: z.enum(AUTO_HIDE_CONDITIONS).array().default(menuConfigDefault.auto_hide),
    buttons: z
      .object({
        call: visibleButtonSchema.default(menuConfigDefault.buttons.call),
        camera_ui: visibleButtonSchema.default(menuConfigDefault.buttons.camera_ui),
        cameras: visibleButtonSchema.default(menuConfigDefault.buttons.cameras),
        clips: hiddenButtonSchema.default(menuConfigDefault.buttons.clips),
        ptz_home: hiddenButtonSchema.default(menuConfigDefault.buttons.ptz_home),
        display_mode: visibleButtonSchema.default(
          menuConfigDefault.buttons.display_mode,
        ),
        download: visibleButtonSchema.default(menuConfigDefault.buttons.download),
        expand: hiddenButtonSchema.default(menuConfigDefault.buttons.expand),
        folders: visibleButtonSchema.default(menuConfigDefault.buttons.folders),
        iris: visibleButtonSchema.default(menuConfigDefault.buttons.iris),
        fullscreen: visibleButtonSchema.default(menuConfigDefault.buttons.fullscreen),
        image: hiddenButtonSchema.default(menuConfigDefault.buttons.image),
        info: visibleButtonSchema.default(menuConfigDefault.buttons.info),
        gallery: visibleButtonSchema.default(menuConfigDefault.buttons.gallery),
        live: visibleButtonSchema.default(menuConfigDefault.buttons.live),
        media_player: visibleButtonSchema.default(
          menuConfigDefault.buttons.media_player,
        ),
        microphone: hiddenButtonSchema
          .extend({
            type: z
              .enum(['momentary', 'toggle'])
              .default(menuConfigDefault.buttons.microphone.type),
          })
          .default(menuConfigDefault.buttons.microphone),
        mute: hiddenButtonSchema.default(menuConfigDefault.buttons.mute),
        pip: hiddenButtonSchema.default(menuConfigDefault.buttons.pip),
        play: hiddenButtonSchema.default(menuConfigDefault.buttons.play),
        ptz_controls: hiddenButtonSchema.default(menuConfigDefault.buttons.ptz_controls),
        recordings: hiddenButtonSchema.default(menuConfigDefault.buttons.recordings),
        reviews: hiddenButtonSchema.default(menuConfigDefault.buttons.reviews),
        set_review: visibleButtonSchema.default(menuConfigDefault.buttons.set_review),
        screenshot: hiddenButtonSchema.default(menuConfigDefault.buttons.screenshot),
        snapshots: hiddenButtonSchema.default(menuConfigDefault.buttons.snapshots),
        substreams: visibleButtonSchema.default(menuConfigDefault.buttons.substreams),
        timeline: visibleButtonSchema.default(menuConfigDefault.buttons.timeline),
      })
      .default(menuConfigDefault.buttons),
    button_size: z.number().min(BUTTON_SIZE_MIN).default(menuConfigDefault.button_size),
  })
  .default(menuConfigDefault);
export type MenuConfig = z.infer<typeof menuConfigSchema>;
