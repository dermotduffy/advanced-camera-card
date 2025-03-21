import { z } from 'zod';
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

const visibleButtonDefault = {
  priority: MENU_PRIORITY_DEFAULT,
  enabled: true,
};

const hiddenButtonDefault = {
  priority: MENU_PRIORITY_DEFAULT,
  enabled: false,
};

export const menuConfigDefault = {
  alignment: 'left' as const,
  button_size: 40,
  buttons: {
    camera_ui: visibleButtonDefault,
    cameras: visibleButtonDefault,
    clips: visibleButtonDefault,
    ptz_home: hiddenButtonDefault,
    display_mode: visibleButtonDefault,
    download: visibleButtonDefault,
    expand: hiddenButtonDefault,
    iris: visibleButtonDefault,
    fullscreen: visibleButtonDefault,
    image: hiddenButtonDefault,
    live: visibleButtonDefault,
    media_player: visibleButtonDefault,
    microphone: {
      ...hiddenButtonDefault,
      type: 'momentary' as const,
    },
    mute: hiddenButtonDefault,
    play: hiddenButtonDefault,
    ptz_controls: hiddenButtonDefault,
    recordings: hiddenButtonDefault,
    screenshot: hiddenButtonDefault,
    snapshots: visibleButtonDefault,
    substreams: visibleButtonDefault,
    timeline: visibleButtonDefault,
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
    buttons: z
      .object({
        camera_ui: visibleButtonSchema.default(menuConfigDefault.buttons.camera_ui),
        cameras: visibleButtonSchema.default(menuConfigDefault.buttons.cameras),
        clips: visibleButtonSchema.default(menuConfigDefault.buttons.clips),
        ptz_home: hiddenButtonSchema.default(menuConfigDefault.buttons.ptz_home),
        display_mode: visibleButtonSchema.default(
          menuConfigDefault.buttons.display_mode,
        ),
        download: visibleButtonSchema.default(menuConfigDefault.buttons.download),
        expand: hiddenButtonSchema.default(menuConfigDefault.buttons.expand),
        iris: visibleButtonSchema.default(menuConfigDefault.buttons.iris),
        fullscreen: visibleButtonSchema.default(menuConfigDefault.buttons.fullscreen),
        image: hiddenButtonSchema.default(menuConfigDefault.buttons.image),
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
        play: hiddenButtonSchema.default(menuConfigDefault.buttons.play),
        ptz_controls: hiddenButtonSchema.default(menuConfigDefault.buttons.ptz_controls),
        recordings: hiddenButtonSchema.default(menuConfigDefault.buttons.recordings),
        screenshot: hiddenButtonSchema.default(menuConfigDefault.buttons.screenshot),
        snapshots: visibleButtonSchema.default(menuConfigDefault.buttons.snapshots),
        substreams: visibleButtonSchema.default(menuConfigDefault.buttons.substreams),
        timeline: visibleButtonSchema.default(menuConfigDefault.buttons.timeline),
      })
      .default(menuConfigDefault.buttons),
    button_size: z.number().min(BUTTON_SIZE_MIN).default(menuConfigDefault.button_size),
  })
  .default(menuConfigDefault);
export type MenuConfig = z.infer<typeof menuConfigSchema>;
