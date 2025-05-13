import { z } from 'zod';
import { actionsSchema } from './actions/types';
import { VIEW_DEFAULT, VIEWS_USER_SPECIFIED } from './common/const';

const keyboardShortcut = z.object({
  key: z.string(),
  ctrl: z.boolean().optional(),
  shift: z.boolean().optional(),
  alt: z.boolean().optional(),
  meta: z.boolean().optional(),
});
export type KeyboardShortcut = z.infer<typeof keyboardShortcut>;

const keyboardShortcutsDefault = {
  enabled: true,
  ptz_left: { key: 'ArrowLeft' },
  ptz_right: { key: 'ArrowRight' },
  ptz_up: { key: 'ArrowUp' },
  ptz_down: { key: 'ArrowDown' },
  ptz_zoom_in: { key: '+' },
  ptz_zoom_out: { key: '-' },
  ptz_home: { key: 'h' },
};

const keyboardShortcutsSchema = z.object({
  enabled: z.boolean().default(keyboardShortcutsDefault.enabled),
  ptz_left: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_left),
  ptz_right: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_right),
  ptz_up: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_up),
  ptz_down: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_down),
  ptz_zoom_in: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_zoom_in),
  ptz_zoom_out: keyboardShortcut
    .nullable()
    .default(keyboardShortcutsDefault.ptz_zoom_out),
  ptz_home: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_home),
});
export type KeyboardShortcuts = z.infer<typeof keyboardShortcutsSchema>;

export type PTZKeyboardShortcutName =
  | 'ptz_down'
  | 'ptz_home'
  | 'ptz_left'
  | 'ptz_right'
  | 'ptz_up'
  | 'ptz_zoom_in'
  | 'ptz_zoom_out';

export const viewConfigDefault = {
  default: VIEW_DEFAULT,
  camera_select: 'current' as const,
  interaction_seconds: 300,
  default_reset: {
    every_seconds: 0,
    after_interaction: false,
    entities: [],
    interaction_mode: 'inactive' as const,
  },
  default_cycle_camera: false,
  dim: false,
  theme: {
    themes: ['traditional' as const],
  },
  triggers: {
    show_trigger_status: false,
    filter_selected_camera: true,
    actions: {
      trigger: 'update' as const,
      untrigger: 'none' as const,
    },
    untrigger_seconds: 0,
  },
  keyboard_shortcuts: keyboardShortcutsDefault,
};

const interactionModeSchema = z.enum(['all', 'inactive', 'active']).default('inactive');
export type InteractionMode = z.infer<typeof interactionModeSchema>;

export const triggersSchema = z.object({
  actions: z
    .object({
      interaction_mode: interactionModeSchema,
      trigger: z
        .enum(['default', 'live', 'media', 'none', 'update'])
        .default(viewConfigDefault.triggers.actions.trigger),
      untrigger: z
        .enum(['default', 'none'])
        .default(viewConfigDefault.triggers.actions.untrigger),
    })
    .default(viewConfigDefault.triggers.actions),
  filter_selected_camera: z
    .boolean()
    .default(viewConfigDefault.triggers.filter_selected_camera),
  show_trigger_status: z
    .boolean()
    .default(viewConfigDefault.triggers.show_trigger_status),
  untrigger_seconds: z.number().default(viewConfigDefault.triggers.untrigger_seconds),
});
export type TriggersOptions = z.infer<typeof triggersSchema>;

const themeName = z.enum(['ha', 'dark', 'light', 'traditional']);
export type ThemeName = z.infer<typeof themeName>;

const themeConfigSchema = z.object({
  themes: themeName.array().default(viewConfigDefault.theme.themes),
  overrides: z.record(z.string()).optional(),
});
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export const viewConfigSchema = z
  .object({
    default: z.enum(VIEWS_USER_SPECIFIED).default(viewConfigDefault.default),
    camera_select: z
      .enum([...VIEWS_USER_SPECIFIED, 'current'])
      .default(viewConfigDefault.camera_select),
    interaction_seconds: z.number().default(viewConfigDefault.interaction_seconds),
    default_cycle_camera: z.boolean().default(viewConfigDefault.default_cycle_camera),

    default_reset: z
      .object({
        after_interaction: z
          .boolean()
          .default(viewConfigDefault.default_reset.after_interaction),
        every_seconds: z.number().default(viewConfigDefault.default_reset.every_seconds),
        entities: z.string().array().default(viewConfigDefault.default_reset.entities),
        interaction_mode: interactionModeSchema.default(
          viewConfigDefault.default_reset.interaction_mode,
        ),
      })
      .default(viewConfigDefault.default_reset),

    render_entities: z.string().array().optional(),

    theme: themeConfigSchema.default(viewConfigDefault.theme),

    dim: z.boolean().default(viewConfigDefault.dim),
    triggers: triggersSchema.default(viewConfigDefault.triggers),
    keyboard_shortcuts: keyboardShortcutsSchema.default(
      viewConfigDefault.keyboard_shortcuts,
    ),
  })
  .merge(actionsSchema)
  .default(viewConfigDefault);
