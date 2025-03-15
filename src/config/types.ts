import { HassServiceTarget } from 'home-assistant-js-websocket';
import { z } from 'zod';
import { MEDIA_CHUNK_SIZE_DEFAULT, MEDIA_CHUNK_SIZE_MAX } from '../const.js';
import { capabilityKeys } from '../types.js';
import { deepRemoveDefaults } from '../utils/zod.js';
import {
  keyboardShortcutsDefault,
  keyboardShortcutsSchema,
} from './keyboard-shortcuts.js';
import { PTZ_ACTIONS } from './ptz';

// *************************************************************************
//                       Common Configuration Constants
// *************************************************************************

export const BUTTON_SIZE_MIN = 20;
export const STATUS_BAR_HEIGHT_MIN = BUTTON_SIZE_MIN;

const MENU_PRIORITY_DEFAULT = 50;
export const MENU_PRIORITY_MAX = 100;

export const STATUS_BAR_PRIORITY_DEFAULT = MENU_PRIORITY_DEFAULT;
export const STATUS_BAR_PRIORITY_MAX = MENU_PRIORITY_MAX;

export const VIEWS_USER_SPECIFIED = [
  'diagnostics',
  'live',
  'clip',
  'clips',
  'snapshot',
  'snapshots',
  'recording',
  'recordings',
  'image',
  'timeline',
] as const;
export type AdvancedCameraCardUserSpecifiedView = (typeof VIEWS_USER_SPECIFIED)[number];

const VIEWS = [
  ...VIEWS_USER_SPECIFIED,
  'diagnostics',

  // Media: A generic piece of media (could be clip, snapshot, recording).
  'media',
] as const;

export type AdvancedCameraCardView = (typeof VIEWS)[number];

// The default view (may not be supported on all cameras).
export const VIEW_DEFAULT = 'live' as const;

export const MEDIA_ACTION_NEGATIVE_CONDITIONS = ['unselected', 'hidden'] as const;
export type LazyUnloadCondition = (typeof MEDIA_ACTION_NEGATIVE_CONDITIONS)[number];
export type AutoPauseCondition = (typeof MEDIA_ACTION_NEGATIVE_CONDITIONS)[number];

const MEDIA_ACTION_POSITIVE_CONDITIONS = ['selected', 'visible'] as const;
export type AutoPlayCondition = (typeof MEDIA_ACTION_POSITIVE_CONDITIONS)[number];
const MEDIA_UNMUTE_CONDITIONS = [
  ...MEDIA_ACTION_POSITIVE_CONDITIONS,
  'microphone',
] as const;
export type AutoUnmuteCondition = (typeof MEDIA_UNMUTE_CONDITIONS)[number];

const MEDIA_MUTE_CONDITIONS = [
  ...MEDIA_ACTION_NEGATIVE_CONDITIONS,
  'microphone',
] as const;
export type AutoMuteCondition = (typeof MEDIA_MUTE_CONDITIONS)[number];

const ACTION_PHASES = ['start', 'stop'] as const;
export type ActionPhase = (typeof ACTION_PHASES)[number];

const CAMERA_TRIGGER_EVENT_TYPES = [
  // An event whether or not it has any media yet associated with it.
  'events',

  // Specific media availability.
  'clips',
  'snapshots',
] as const;
export type CameraTriggerEventType = (typeof CAMERA_TRIGGER_EVENT_TYPES)[number];

const cardIDRegex = /^[-\w]+$/;

// *************************************************************************
//                        Pan / Zoom
// *************************************************************************

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;

const panSchema = z.object({
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
});
const zoomSchema = z.number().min(ZOOM_MIN).max(ZOOM_MAX);

// *************************************************************************
//                        View Display Mode
// *************************************************************************

const viewDisplayModeSchema = z.enum(['single', 'grid']);
export type ViewDisplayMode = z.infer<typeof viewDisplayModeSchema>;

const viewDisplaySchema = z
  .object({
    mode: viewDisplayModeSchema.optional(),
    grid_selected_width_factor: z.number().min(0).optional(),
    grid_max_columns: z.number().min(0).optional(),
    grid_columns: z.number().min(0).optional(),
  })
  .optional();
export type ViewDisplayConfig = z.infer<typeof viewDisplaySchema>;

// *************************************************************************
//                          Stock Actions
// *************************************************************************

// https://www.home-assistant.io/dashboards/actions/#options-for-confirmation
const actionBaseSchema = z.object({
  confirmation: z
    .boolean()
    .or(
      z.object({
        text: z.string().optional(),
        exemptions: z
          .object({
            user: z.string(),
          })
          .array()
          .optional(),
      }),
    )
    .optional(),

  card_id: z
    .string()
    .regex(cardIDRegex, 'card_id parameter can only contain [a-z][A-Z][0-9_]-')
    .optional(),
});

const toggleActionSchema = actionBaseSchema.extend({
  action: z.literal('toggle'),
});
export type ToggleActionConfig = z.infer<typeof toggleActionSchema>;

const targetSchema: z.ZodSchema<HassServiceTarget, z.ZodTypeDef> = z.object({
  entity_id: z.string().or(z.string().array()).optional(),
  device_id: z.string().or(z.string().array()).optional(),
  area_id: z.string().or(z.string().array()).optional(),
  floor_id: z.string().or(z.string().array()).optional(),
  label_id: z.string().or(z.string().array()).optional(),
});

const performActionActionSchema = actionBaseSchema.extend({
  action: z.literal('perform-action'),
  perform_action: z.string(),
  data: z.object({}).passthrough().optional(),
  target: targetSchema.optional(),
});
export type PerformActionActionConfig = z.infer<typeof performActionActionSchema>;

// Note: call-service is deprecated and will eventually go away. Please use
// perform-action instead.
// See: https://www.home-assistant.io/blog/2024/08/07/release-20248/#goodbye-service-calls-hello-actions-
const callServiceActionSchema = actionBaseSchema.extend({
  action: z.literal('call-service'),
  service: z.string(),
  data: z.object({}).passthrough().optional(),
  target: targetSchema.optional(),
});
export type CallServiceActionConfig = z.infer<typeof callServiceActionSchema>;

const navigateActionSchema = actionBaseSchema.extend({
  action: z.literal('navigate'),
  navigation_path: z.string(),
  navigation_replace: z.boolean().optional(),
});
export type NavigateActionConfig = z.infer<typeof navigateActionSchema>;

const urlActionSchema = actionBaseSchema.extend({
  action: z.literal('url'),
  url_path: z.string(),
});
export type URLActionConfig = z.infer<typeof urlActionSchema>;

const moreInfoActionSchema = actionBaseSchema.extend({
  action: z.literal('more-info'),
  entity: z.string().optional(),
});
export type MoreInfoActionConfig = z.infer<typeof moreInfoActionSchema>;

const customActionSchema = actionBaseSchema
  .extend({
    action: z.literal('fire-dom-event'),
  })
  .passthrough();
export type CustomActionConfig = z.infer<typeof customActionSchema>;

const noneActionSchema = actionBaseSchema.extend({
  action: z.literal('none'),
});
export type NoneActionConfig = z.infer<typeof noneActionSchema>;

export const advancedCameraCardCustomActionsBaseSchema = actionBaseSchema.extend({
  action: z
    .literal('fire-dom-event')
    .or(
      z
        .literal('custom:advanced-camera-card-action')
        .transform((): 'fire-dom-event' => 'fire-dom-event'),
    ),
});

// *************************************************************************
//                           Custom Actions
// *************************************************************************

const GENERAL_ACTIONS = [
  'camera_ui',
  'default',
  'download',
  'expand',
  'fullscreen',
  'live_substream_off',
  'live_substream_on',
  'menu_toggle',
  'microphone_connect',
  'microphone_disconnect',
  'microphone_mute',
  'microphone_unmute',
  'mute',
  'pause',
  'play',
  'screenshot',
  'unmute',
] as const;
export type AdvancedCameraCardGeneralAction = (typeof GENERAL_ACTIONS)[number];

const viewActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.enum(VIEWS_USER_SPECIFIED),
});
export type ViewActionConfig = z.infer<typeof viewActionConfigSchema>;

const generalActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.enum(GENERAL_ACTIONS),
});
export type GeneralActionConfig = z.infer<typeof generalActionConfigSchema>;

const cameraSelectActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('camera_select'),
  camera: z.string().optional(),
  triggered: z.boolean().optional(),
});
export type CameraSelectActionConfig = z.infer<typeof cameraSelectActionConfigSchema>;

const substreamSelectActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('live_substream_select'),
    camera: z.string(),
  });
export type SubstreamSelectActionConfig = z.infer<
  typeof substreamSelectActionConfigSchema
>;

const mediaPlayerActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('media_player'),
  media_player: z.string(),
  media_player_action: z.enum(['play', 'stop']),
});
export type MediaPlayerActionConfig = z.infer<typeof mediaPlayerActionConfigSchema>;

const viewDisplayModeActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('display_mode_select'),
    display_mode: viewDisplayModeSchema,
  });
export type DisplayModeActionConfig = z.infer<typeof viewDisplayModeActionConfigSchema>;

const ptzActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('ptz'),
  camera: z.string().optional(),
  ptz_action: z.enum(PTZ_ACTIONS).optional(),
  ptz_phase: z.enum(ACTION_PHASES).optional(),
  ptz_preset: z.string().optional(),
});
export type PTZActionConfig = z.infer<typeof ptzActionConfigSchema>;

const ptzDigitalActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('ptz_digital'),
  target_id: z.string().optional(),
  absolute: z
    .object({
      zoom: zoomSchema.optional(),
      pan: panSchema.optional(),
    })
    .optional(),
  ptz_action: z.enum(PTZ_ACTIONS).optional(),
  ptz_phase: z.enum(ACTION_PHASES).optional(),
});
export type PTZDigitialActionConfig = z.infer<typeof ptzDigitalActionConfigSchema>;

const ptzMultiActionSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('ptz_multi'),
  target_id: z.string().optional(),

  ptz_action: z.enum(PTZ_ACTIONS).optional(),
  ptz_phase: z.enum(ACTION_PHASES).optional(),
  ptz_preset: z.string().optional(),
});
export type PTZMultiActionConfig = z.infer<typeof ptzMultiActionSchema>;

const ptzControlsActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('ptz_controls'),
  enabled: z.boolean(),
});
export type PTZControlsActionConfig = z.infer<typeof ptzControlsActionConfigSchema>;

const timeDeltaSchema = z.object({
  ms: z.number().optional(),
  s: z.number().optional(),
  m: z.number().optional(),
  h: z.number().optional(),
});
export type TimeDelta = z.infer<typeof timeDeltaSchema>;

const sleepActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('sleep'),
  duration: timeDeltaSchema.optional().default({ s: 1 }),
});
export type SleepActionConfig = z.infer<typeof sleepActionConfigSchema>;

// For StatusBarActionConfig provide a manual type definition to avoid the `any`
// that would be created by the lazy() evaluation below.
// See: https://zod.dev/?id=recursive-types
const statusBarActionConfigSchemaBase = advancedCameraCardCustomActionsBaseSchema.extend(
  {
    advanced_camera_card_action: z.literal('status_bar'),
    status_bar_action: z.enum(['add', 'remove', 'reset']),
  },
);
export type StatusBarActionConfig = z.infer<typeof statusBarActionConfigSchemaBase> & {
  items?: StatusBarItem[];
};
export const statusBarActionConfigSchema: z.ZodSchema<
  StatusBarActionConfig,
  z.ZodTypeDef,
  unknown
> = statusBarActionConfigSchemaBase.extend({
  items: z
    .lazy(() => statusBarItemSchema)
    .array()
    .optional(),
});

const LOG_ACTIONS_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogActionLevel = (typeof LOG_ACTIONS_LEVELS)[number];

const logActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('log'),
  message: z.string(),
  level: z.enum(LOG_ACTIONS_LEVELS).default('info'),
});
export type LogActionConfig = z.infer<typeof logActionConfigSchema>;

// An action that can be used internally to call a callback (it is not possible
// for the user to pass this through via the configuration).
export const INTERNAL_CALLBACK_ACTION = '__INTERNAL_CALLBACK_ACTION__';
const internalCallbackActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal(INTERNAL_CALLBACK_ACTION),

    // The callback is expected to be called with a CardController API object.
    callback: z.function().args(z.any()).returns(z.promise(z.void())),
  });
export type InternalCallbackActionConfig = z.infer<
  typeof internalCallbackActionConfigSchema
>;

const stockActionSchema = z.union([
  callServiceActionSchema,
  customActionSchema,
  moreInfoActionSchema,
  navigateActionSchema,
  noneActionSchema,
  performActionActionSchema,
  toggleActionSchema,
  urlActionSchema,
]);

const advancedCameraCardCustomActionSchema = z.union([
  cameraSelectActionConfigSchema,
  generalActionConfigSchema,
  internalCallbackActionConfigSchema,
  logActionConfigSchema,
  mediaPlayerActionConfigSchema,
  ptzActionConfigSchema,
  ptzControlsActionConfigSchema,
  ptzDigitalActionConfigSchema,
  ptzMultiActionSchema,
  sleepActionConfigSchema,
  statusBarActionConfigSchema,
  substreamSelectActionConfigSchema,
  viewActionConfigSchema,
  viewDisplayModeActionConfigSchema,
]);
export type AdvancedCameraCardCustomActionConfig = z.infer<
  typeof advancedCameraCardCustomActionSchema
>;

const actionConfigSchema = z.union([
  stockActionSchema,
  advancedCameraCardCustomActionSchema,
]);
export type ActionConfig = z.infer<typeof actionConfigSchema>;

export interface AuxillaryActionConfig {
  entity?: string;
}

const actionsBaseSchema = z
  .object({
    tap_action: actionConfigSchema.or(actionConfigSchema.array()).optional(),
    hold_action: actionConfigSchema.or(actionConfigSchema.array()).optional(),
    double_tap_action: actionConfigSchema.or(actionConfigSchema.array()).optional(),
    start_tap_action: actionConfigSchema.or(actionConfigSchema.array()).optional(),
    end_tap_action: actionConfigSchema.or(actionConfigSchema.array()).optional(),
  })
  // Passthrough to allow (at least) entity/camera_image to go through. This
  // card doesn't need these attributes, but handleAction() in
  // custom_card_helpers may depending on how the action is configured.
  .passthrough();
export type Actions = z.infer<typeof actionsBaseSchema>;
export type ActionsConfig = Actions & AuxillaryActionConfig;

const actionsSchema = z.object({
  actions: actionsBaseSchema.optional(),
});

// *************************************************************************
//                         Picture Elements
//
// All picture element types are validated (not just the Advanced Camera Card
// custom ones) as a convenience to present the user with a consistent error
// display up-front regardless of where they made their error.
// *************************************************************************

const elementsBaseSchema = actionsBaseSchema.extend({
  style: z.record(z.string().nullable().or(z.undefined()).or(z.number())).optional(),
  title: z.string().nullable().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-badge
const stateBadgeIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-badge'),
  entity: z.string(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-icon
const stateIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-icon'),
  entity: z.string(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-label
const stateLabelSchema = elementsBaseSchema.extend({
  type: z.literal('state-label'),
  entity: z.string(),
  attribute: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#service-call-button
const serviceCallButtonSchema = elementsBaseSchema.extend({
  type: z.literal('service-button'),
  // Title is required for service button.
  title: z.string(),
  service: z.string(),
  service_data: z.object({}).passthrough().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#icon-element
const iconSchema = elementsBaseSchema.extend({
  type: z.literal('icon'),
  icon: z.string(),
  entity: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const imageSchema = elementsBaseSchema.extend({
  type: z.literal('image'),
  entity: z.string().optional(),
  image: z.string().optional(),
  camera_image: z.string().optional(),
  camera_view: z.string().optional(),
  state_image: z.object({}).passthrough().optional(),
  filter: z.string().optional(),
  state_filter: z.object({}).passthrough().optional(),
  aspect_ratio: z.string().optional(),
});

// https://www.home-assistant.io/dashboards/conditional/#state
const stateConditionSchema = z.object({
  // If the condition is not specified, a state condition is assumed. This
  // allows the syntax to match a picture elements conditional:
  // https://www.home-assistant.io/dashboards/picture-elements/#conditional-element
  condition: z.literal('state').optional(),
  entity: z.string(),
  state: z.string().or(z.string().array()).optional(),
  state_not: z.string().or(z.string().array()).optional(),
});

// https://www.home-assistant.io/dashboards/conditional/#numeric-state
const numericStateConditionSchema = z.object({
  condition: z.literal('numeric_state'),
  entity: z.string(),
  above: z.number().optional(),
  below: z.number().optional(),
});

// https://www.home-assistant.io/dashboards/conditional/#screen
const screenConditionSchema = z.object({
  condition: z.literal('screen'),
  media_query: z.string(),
});

// https://www.home-assistant.io/dashboards/conditional/#user
const usersConditionSchema = z.object({
  condition: z.literal('user'),
  users: z.string().array().min(1),
});

const stockConditionSchema = z.discriminatedUnion('condition', [
  stateConditionSchema,
  numericStateConditionSchema,
  screenConditionSchema,
  usersConditionSchema,
]);

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
export const conditionalSchema = z.object({
  type: z.literal('conditional'),
  conditions: stockConditionSchema.array(),
  elements: z.lazy(() => pictureElementsSchema),
});

// https://www.home-assistant.io/lovelace/picture-elements/#custom-elements
export const customSchema = z
  .object({
    // Insist that Advanced Camera Card custom elements are handled by other schemas.
    type: z.string().superRefine((val, ctx) => {
      if (!val.match(/^custom:(?!advanced-camera-card).+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'advanced-camera-card custom elements must match specific schemas',
          fatal: true,
        });
      }
    }),
  })
  .passthrough();

// *************************************************************************
//               Custom Element Configuration: Menu
// *************************************************************************

const menuBaseSchema = z.object({
  enabled: z.boolean().default(true).optional(),
  priority: z
    .number()
    .min(0)
    .max(MENU_PRIORITY_MAX)
    .default(MENU_PRIORITY_DEFAULT)
    .optional(),
  alignment: z.enum(['matching', 'opposing']).default('matching').optional(),
  icon: z.string().optional(),
  permanent: z.boolean().default(false).optional(),
});

const menuIconSchema = menuBaseSchema.merge(iconSchema).extend({
  type: z.literal('custom:advanced-camera-card-menu-icon'),
});
export type MenuIcon = z.infer<typeof menuIconSchema>;

const menuStateIconSchema = menuBaseSchema
  .merge(stateIconSchema)
  .extend({
    type: z.literal('custom:advanced-camera-card-menu-state-icon'),
  })
  .merge(menuBaseSchema);
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;

const menuSubmenuItemSchema = elementsBaseSchema.extend({
  entity: z.string().optional(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
  selected: z.boolean().default(false),
  subtitle: z.string().optional(),
  enabled: z.boolean().default(true),
});
export type MenuSubmenuItem = z.infer<typeof menuSubmenuItemSchema>;

const menuSubmenuSchema = menuBaseSchema.merge(iconSchema).extend({
  type: z.literal('custom:advanced-camera-card-menu-submenu'),
  items: menuSubmenuItemSchema.array(),
});
export type MenuSubmenu = z.infer<typeof menuSubmenuSchema>;

const menuSubmenuSelectSchema = menuBaseSchema.merge(stateIconSchema).extend({
  type: z.literal('custom:advanced-camera-card-menu-submenu-select'),
  options: z.record(menuSubmenuItemSchema.deepPartial()).optional(),
});
export type MenuSubmenuSelect = z.infer<typeof menuSubmenuSelectSchema>;
export type MenuItem = MenuIcon | MenuStateIcon | MenuSubmenu | MenuSubmenuSelect;

// *************************************************************************
//               Custom Element Configuration: Status bar
// *************************************************************************

const statusBarItemBaseSchema = z.object({
  enabled: z.boolean().default(true).optional(),
  priority: z
    .number()
    .min(0)
    .max(STATUS_BAR_PRIORITY_MAX)
    .default(STATUS_BAR_PRIORITY_DEFAULT)
    .optional(),
});

const statusBarItemElementsBaseSchema = statusBarItemBaseSchema.extend({
  sufficient: z.boolean().default(false).optional(),
  exclusive: z.boolean().default(false).optional(),
  expand: z.boolean().default(false).optional(),
  actions: actionsBaseSchema.optional(),
});

const statusBarIconItemSchema = statusBarItemElementsBaseSchema.extend({
  type: z.literal('custom:advanced-camera-card-status-bar-icon'),
  icon: z.string(),
});
export type StatusBarIcon = z.infer<typeof statusBarIconItemSchema>;

const statusBarImageItemSchema = statusBarItemElementsBaseSchema.extend({
  type: z.literal('custom:advanced-camera-card-status-bar-image'),
  image: z.string(),
});
export type StatusBarImage = z.infer<typeof statusBarImageItemSchema>;

const statusBarStringItemSchema = statusBarItemElementsBaseSchema.extend({
  type: z.literal('custom:advanced-camera-card-status-bar-string'),
  string: z.string(),
});
export type StatusBarString = z.infer<typeof statusBarStringItemSchema>;

const statusBarItemSchema = z.union([
  statusBarIconItemSchema,
  statusBarImageItemSchema,
  statusBarStringItemSchema,
]);
export type StatusBarItem = z.infer<typeof statusBarItemSchema>;

// *************************************************************************
//                  Custom Element Configuration: Conditions
// *************************************************************************

const cameraConditionSchema = z.object({
  condition: z.literal('camera'),
  cameras: z.string().array().optional(),
});
const configConditionSchema = z.object({
  condition: z.literal('config'),
  paths: z.string().array().optional(),
});
const displayModeConditionSchema = z.object({
  condition: z.literal('display_mode'),
  display_mode: viewDisplayModeSchema,
});
const expandConditionSchema = z.object({
  condition: z.literal('expand'),
  expand: z.boolean(),
});
const fullscreenConditionSchema = z.object({
  condition: z.literal('fullscreen'),
  fullscreen: z.boolean(),
});
const initializedConditionSchema = z.object({
  condition: z.literal('initialized'),
});
const interactionConditionSchema = z.object({
  condition: z.literal('interaction'),
  interaction: z.boolean(),
});
const keyConditionSchema = z.object({
  condition: z.literal('key'),
  key: z.string(),
  state: z.enum(['down', 'up']).optional(),
  ctrl: z.boolean().optional(),
  shift: z.boolean().optional(),
  alt: z.boolean().optional(),
  meta: z.boolean().optional(),
});
const mediaLoadedConditionSchema = z.object({
  condition: z.literal('media_loaded'),
  media_loaded: z.boolean(),
});
const microphoneConditionSchema = z.object({
  condition: z.literal('microphone'),
  connected: z.boolean().optional(),
  muted: z.boolean().optional(),
});
const triggeredConditionSchema = z.object({
  condition: z.literal('triggered'),
  triggered: z.string().array(),
});
const userAgentConditionSchema = z.object({
  condition: z.literal('user_agent'),
  user_agent: z.string().optional(),
  user_agent_re: z
    .string()
    .refine(
      (val) => {
        try {
          new RegExp(val);
        } catch {
          return false;
        }
        return true;
      },
      { message: 'Invalid regular expression' },
    )
    .optional(),
  companion: z.boolean().optional(),
});
const viewConditionSchema = z.object({
  condition: z.literal('view'),
  views: z.string().array().optional(),
});

export const advancedCameraCardConditionSchema = z.discriminatedUnion('condition', [
  // Stock conditions:
  numericStateConditionSchema,
  screenConditionSchema,
  stateConditionSchema,
  usersConditionSchema,

  // Custom conditions:
  cameraConditionSchema,
  configConditionSchema,
  displayModeConditionSchema,
  expandConditionSchema,
  fullscreenConditionSchema,
  initializedConditionSchema,
  interactionConditionSchema,
  keyConditionSchema,
  mediaLoadedConditionSchema,
  microphoneConditionSchema,
  triggeredConditionSchema,
  userAgentConditionSchema,
  viewConditionSchema,
]);
export type AdvancedCameraCardCondition = z.infer<
  typeof advancedCameraCardConditionSchema
>;

const advancedCameraCardConditionalSchema = z.object({
  type: z.literal('custom:advanced-camera-card-conditional'),
  conditions: advancedCameraCardConditionSchema.array(),
  elements: z.lazy(() => pictureElementsSchema),
});
export type AdvancedCameraCardConditional = z.infer<
  typeof advancedCameraCardConditionalSchema
>;

// *************************************************************************
//       Custom Element Configuration: Stock Picture Elements + Custom
// *************************************************************************

// Cannot use discriminatedUnion since customSchema uses a superRefine, which
// causes false rejections.
const pictureElementSchema = z.union([
  conditionalSchema,
  customSchema,
  advancedCameraCardConditionalSchema,
  iconSchema,
  imageSchema,
  menuIconSchema,
  menuStateIconSchema,
  menuSubmenuSchema,
  menuSubmenuSelectSchema,
  serviceCallButtonSchema,
  stateBadgeIconSchema,
  stateIconSchema,
  stateLabelSchema,
  statusBarIconItemSchema,
  statusBarImageItemSchema,
  statusBarStringItemSchema,
]);
const pictureElementsSchema = pictureElementSchema.array().optional();
export type PictureElements = z.infer<typeof pictureElementsSchema>;

// *************************************************************************
//                     Media Layout Configuration
// *************************************************************************

const mediaLayoutConfigSchema = z.object({
  fit: z.enum(['contain', 'cover', 'fill']).optional(),
  position: z
    .object({
      x: z.number().min(0).max(100).optional(),
      y: z.number().min(0).max(100).optional(),
    })
    .optional(),
  view_box: z
    .object({
      bottom: z.number().min(0).max(100).optional().default(0),
      left: z.number().min(0).max(100).optional().default(0),
      right: z.number().min(0).max(100).optional().default(0),
      top: z.number().min(0).max(100).optional().default(0),
    })
    .optional(),
  pan: panSchema.optional(),
  zoom: zoomSchema.optional(),
});
export type MediaLayoutConfig = z.infer<typeof mediaLayoutConfigSchema>;

// *************************************************************************
//                     Aspect Ratio Configuration
// *************************************************************************

const aspectRatioSchema = z
  .number()
  .array()
  .length(2)
  .or(
    z
      .string()
      .regex(/^\s*\d+\.?\d*\s*[:/]\s*\d+\.?\d*\s*$/)
      .transform((input) => input.split(/[:\/]/).map((d) => Number(d))),
  );

// *************************************************************************
//                         PTZ Configuration
// *************************************************************************

const ptzCameraConfigDefaults = {
  r2c_delay_between_calls_seconds: 0.5,
  c2r_delay_between_calls_seconds: 0.2,
};

// To avoid lots of YAML duplication, provide an easy way to just specify the
// service data as actions for each PTZ action, and it will be preprocessed
// into the full form. This also provides compatability with the AlexIT/WebRTC
// PTZ configuration.
const dataPTZFormatToFullFormat = function (suffix: string): (data: unknown) => unknown {
  return (data) => {
    if (!data || typeof data !== 'object' || !data['service']) {
      return data;
    }
    const out = { ...data };
    Object.keys(data).forEach((key) => {
      const match = key.match(/^data_(.+)$/);
      const name = match?.[1];
      if (name && !(`${suffix}${name}` in data)) {
        out[`${suffix}${name}`] = {
          action: 'perform-action',
          perform_action: data['service'],
          data: data[key],
        };
        delete out[key];
        delete out['service'];
      }
    });
    return out;
  };
};

const ptzCameraConfigSchema = z.preprocess(
  dataPTZFormatToFullFormat('actions_'),
  z
    .object({
      actions_left: performActionActionSchema.optional(),
      actions_left_start: performActionActionSchema.optional(),
      actions_left_stop: performActionActionSchema.optional(),

      actions_right: performActionActionSchema.optional(),
      actions_right_start: performActionActionSchema.optional(),
      actions_right_stop: performActionActionSchema.optional(),

      actions_up: performActionActionSchema.optional(),
      actions_up_start: performActionActionSchema.optional(),
      actions_up_stop: performActionActionSchema.optional(),

      actions_down: performActionActionSchema.optional(),
      actions_down_start: performActionActionSchema.optional(),
      actions_down_stop: performActionActionSchema.optional(),

      actions_zoom_in: performActionActionSchema.optional(),
      actions_zoom_in_start: performActionActionSchema.optional(),
      actions_zoom_in_stop: performActionActionSchema.optional(),

      actions_zoom_out: performActionActionSchema.optional(),
      actions_zoom_out_start: performActionActionSchema.optional(),
      actions_zoom_out_stop: performActionActionSchema.optional(),

      // The number of seconds between subsequent relative calls when converting a
      // relative request into a continuous request.
      r2c_delay_between_calls_seconds: z
        .number()
        .default(ptzCameraConfigDefaults.r2c_delay_between_calls_seconds),

      // The number of seconds between the start/stop call when converting a
      // continuous request into a relative request.
      c2r_delay_between_calls_seconds: z
        .number()
        .default(ptzCameraConfigDefaults.c2r_delay_between_calls_seconds),

      presets: z
        .preprocess(
          dataPTZFormatToFullFormat(''),
          z.union([
            z.record(performActionActionSchema),

            // This is used by the data_ style of action.
            z.object({ service: z.string().optional() }),
          ]),
        )
        .optional(),

      // This is used by the data_ style of action.
      service: z.string().optional(),
    })
    // We allow passthrough as there may be user-configured presets as "actions_<preset>" .
    .passthrough(),
);

const ptzControlsDefaults = {
  orientation: 'horizontal' as const,
  mode: 'auto' as const,
  hide_pan_tilt: false,
  hide_zoom: false,
  hide_home: false,
  position: 'bottom-right' as const,
};

export const ptzControlsConfigSchema = z.object({
  mode: z.enum(['off', 'auto', 'on']).default(ptzControlsDefaults.mode),
  position: z
    .enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
    .default(ptzControlsDefaults.position),
  orientation: z
    .enum(['vertical', 'horizontal'])
    .default(ptzControlsDefaults.orientation),

  hide_pan_tilt: z.boolean().default(ptzControlsDefaults.hide_pan_tilt),
  hide_zoom: z.boolean().default(ptzControlsDefaults.hide_zoom),
  hide_home: z.boolean().default(ptzControlsDefaults.hide_home),

  style: z.object({}).passthrough().optional(),
});
export type PTZControlsConfig = z.infer<typeof ptzControlsConfigSchema>;

// *************************************************************************
//                     Image Configuration
// Image config base options are used both for the `image` live provider and the
// `image` card view.
// *************************************************************************

const imageConfigDefault = {
  mode: 'auto' as const,
  refresh_seconds: 1,
  zoomable: true,
};

const IMAGE_MODES = ['auto', 'camera', 'entity', 'screensaver', 'url'] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

const imageBaseConfigSchema = z.object({
  mode: z.enum(IMAGE_MODES).default(imageConfigDefault.mode),

  refresh_seconds: z.number().min(0).default(imageConfigDefault.refresh_seconds),

  url: z.string().optional(),
  entity: z.string().optional(),
  entity_parameters: z.string().optional(),
});

const imageConfigSchema = imageBaseConfigSchema
  .extend({
    zoomable: z.boolean().default(imageConfigDefault.zoomable),
  })
  .merge(actionsSchema)
  .default(imageConfigDefault);
export type ImageViewConfig = z.infer<typeof imageConfigSchema>;

// *************************************************************************
//                     Thumbnail Configuration
// *************************************************************************

// The min/max width thumbnail.
export const THUMBNAIL_WIDTH_MIN = 75;
export const THUMBNAIL_WIDTH_MAX = 300;

const thumbnailControlsBaseDefaults = {
  size: 100,
  show_details: true,
  show_favorite_control: true,
  show_timeline_control: true,
  show_download_control: true,
};

// Configuration for the actual rendered thumbnail.
const thumbnailsControlBaseSchema = z.object({
  size: z
    .number()
    .min(THUMBNAIL_WIDTH_MIN)
    .max(THUMBNAIL_WIDTH_MAX)
    .default(thumbnailControlsBaseDefaults.size),
  show_details: z.boolean().default(thumbnailControlsBaseDefaults.show_details),
  show_favorite_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_favorite_control),
  show_timeline_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_timeline_control),
  show_download_control: z
    .boolean()
    .default(thumbnailControlsBaseDefaults.show_download_control),
});
export type ThumbnailsControlBaseConfig = z.infer<typeof thumbnailsControlBaseSchema>;

const thumbnailControlsDefaults = {
  ...thumbnailControlsBaseDefaults,
  mode: 'right' as const,
};

const thumbnailsControlSchema = thumbnailsControlBaseSchema.extend({
  mode: z
    .enum(['none', 'above', 'below', 'left', 'right'])
    .default(thumbnailControlsDefaults.mode),
});
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlSchema>;

// *************************************************************************
//                     Event Media Type Configuration
// *************************************************************************
const eventsMediaTypeSchema = z.enum(['all', 'clips', 'snapshots']);

// *************************************************************************
//                     Timeline Configuration
// *************************************************************************

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

const timelineCoreConfigSchema = z.object({
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

const miniTimelineConfigDefault = {
  ...timelineCoreConfigDefault,
  mode: 'none' as const,

  // Mini-timeline defaults to ribbon style.
  style: 'ribbon' as const,
};

const miniTimelineConfigSchema = timelineCoreConfigSchema.extend({
  mode: z.enum(['none', 'above', 'below']).default(miniTimelineConfigDefault.mode),
  style: timelineCoreConfigSchema.shape.style.default(miniTimelineConfigDefault.style),
});
export type MiniTimelineControlConfig = z.infer<typeof miniTimelineConfigSchema>;

const timelineConfigDefault = {
  ...timelineCoreConfigDefault,
  controls: {
    thumbnails: thumbnailControlsDefaults,
  },
};
const timelineConfigSchema = timelineCoreConfigSchema
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

// *************************************************************************
//                 Next/Previous Control Configuration
// *************************************************************************

const nextPreviousControlConfigSchema = z.object({
  style: z.enum(['none', 'chevrons', 'icons', 'thumbnails']),
  size: z.number().min(BUTTON_SIZE_MIN),
});
export type NextPreviousControlConfig = z.infer<typeof nextPreviousControlConfigSchema>;

// *************************************************************************
//                 Carousel Transition Configuration
// *************************************************************************

const transitionEffectConfigSchema = z.enum(['none', 'slide']);
export type TransitionEffect = z.infer<typeof transitionEffectConfigSchema>;

// *************************************************************************
//                     Live Configuration
// *************************************************************************

const LIVE_PROVIDERS = [
  'auto',
  'image',
  'ha',
  'jsmpeg',
  'go2rtc',
  'webrtc-card',
] as const;
export type LiveProvider = (typeof LIVE_PROVIDERS)[number];

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

const go2rtcConfigSchema = z.object({
  url: z
    .string()
    .transform((input) => input.replace(/\/+$/, ''))
    .optional(),
  host: z.string().optional(),
  modes: z.enum(['webrtc', 'mse', 'mp4', 'mjpeg']).array().optional(),
  stream: z.string().optional(),
});

const webrtcCardConfigSchema = z
  .object({
    entity: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

const jsmpegConfigSchema = z.object({
  options: z
    .object({
      // https://github.com/phoboslab/jsmpeg#usage
      audio: z.boolean().optional(),
      video: z.boolean().optional(),
      pauseWhenHidden: z.boolean().optional(),
      disableGl: z.boolean().optional(),
      disableWebAssembly: z.boolean().optional(),
      preserveDrawingBuffer: z.boolean().optional(),
      progressive: z.boolean().optional(),
      throttled: z.boolean().optional(),
      chunkSize: z.number().optional(),
      maxAudioLag: z.number().optional(),
      videoBufferSize: z.number().optional(),
      audioBufferSize: z.number().optional(),
    })
    .optional(),
});

const liveThumbnailControlsDefaults = {
  ...thumbnailControlsDefaults,
  media_type: 'events' as const,
  events_media_type: 'all' as const,
};

const liveConfigDefault = {
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

const liveConfigSchema = z
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

// *************************************************************************
//                       Cast Configuration
// *************************************************************************

const castConfigDefault = {
  method: 'standard' as const,
};

const castSchema = z.object({
  method: z.enum(['standard', 'dashboard']).default(castConfigDefault.method).optional(),
  dashboard: z
    .object({
      dashboard_path: z.string().optional(),
      view_path: z.string().optional(),
    })
    .optional(),
});

// *************************************************************************
//                     Camera Configuration
// *************************************************************************

const ENGINES = ['auto', 'frigate', 'generic', 'motioneye', 'reolink'] as const;

const cameraConfigDefault = {
  dependencies: {
    all_cameras: false,
    cameras: [],
  },
  engine: 'auto' as const,
  frigate: {
    client_id: 'frigate' as const,
  },
  live_provider: 'auto' as const,
  motioneye: {
    images: {
      directory_pattern: '%Y-%m-%d' as const,
      file_pattern: '%H-%M-%S' as const,
    },
    movies: {
      directory_pattern: '%Y-%m-%d' as const,
      file_pattern: '%H-%M-%S' as const,
    },
  },
  reolink: {
    media_resolution: 'low' as const,
  },
  ptz: ptzCameraConfigDefaults,
  triggers: {
    motion: false,
    occupancy: false,
    events: [...CAMERA_TRIGGER_EVENT_TYPES],
    entities: [],
  },
  proxy: {
    media: 'auto' as const,
    dynamic: true,
    ssl_verification: 'auto' as const,
    ssl_ciphers: 'auto' as const,
  },
  always_error_if_entity_unavailable: false,
};

const SSL_CIPHERS = ['default', 'insecure', 'intermediate', 'modern'] as const;
export type SSLCiphers = (typeof SSL_CIPHERS)[number];

const proxyConfigSchema = z.object({
  media: z.boolean().or(z.literal('auto')).default(cameraConfigDefault.proxy.media),
  dynamic: z.boolean().default(cameraConfigDefault.proxy.dynamic),
  ssl_verification: z
    .boolean()
    .or(z.literal('auto'))
    .default(cameraConfigDefault.proxy.ssl_verification),
  ssl_ciphers: z
    .enum(SSL_CIPHERS)
    .or(z.literal('auto'))
    .default(cameraConfigDefault.proxy.ssl_ciphers),
});
export type ProxyConfig = z.infer<typeof proxyConfigSchema>;

export const cameraConfigSchema = z
  .object({
    camera_entity: z.string().optional(),

    // Used for presentation in the UI (autodetected from the entity if
    // specified).
    icon: z.string().optional(),
    title: z.string().optional(),

    capabilities: z
      .object({
        disable: z.enum(capabilityKeys).array().optional(),
        disable_except: z.enum(capabilityKeys).array().optional(),
      })
      .optional(),

    // Optional identifier to separate different camera configurations used in
    // this card.
    id: z.string().optional(),

    dependencies: z
      .object({
        all_cameras: z.boolean().default(cameraConfigDefault.dependencies.all_cameras),
        cameras: z.string().array().default(cameraConfigDefault.dependencies.cameras),
      })
      .default(cameraConfigDefault.dependencies),

    triggers: z
      .object({
        motion: z.boolean().default(cameraConfigDefault.triggers.motion),
        occupancy: z.boolean().default(cameraConfigDefault.triggers.occupancy),
        entities: z.string().array().default(cameraConfigDefault.triggers.entities),
        events: z
          .enum(CAMERA_TRIGGER_EVENT_TYPES)
          .array()
          .default(cameraConfigDefault.triggers.events),
      })
      .default(cameraConfigDefault.triggers),

    // Engine options.
    engine: z.enum(ENGINES).default('auto'),
    frigate: z
      .object({
        url: z.string().optional(),
        client_id: z.string().default(cameraConfigDefault.frigate.client_id),
        camera_name: z.string().optional(),
        labels: z.string().array().optional(),
        zones: z.string().array().optional(),
      })
      .default(cameraConfigDefault.frigate),
    motioneye: z
      .object({
        url: z.string().optional(),
        images: z
          .object({
            directory_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.images.directory_pattern),
            file_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.images.file_pattern),
          })
          .default(cameraConfigDefault.motioneye.images),
        movies: z
          .object({
            directory_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.movies.directory_pattern),
            file_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.movies.file_pattern),
          })
          .default(cameraConfigDefault.motioneye.movies),
      })
      .default(cameraConfigDefault.motioneye),
    reolink: z
      .object({
        url: z.string().optional(),
        media_resolution: z
          .enum(['high', 'low'])
          .default(cameraConfigDefault.reolink.media_resolution),
      })
      .default(cameraConfigDefault.reolink),

    // Live provider options.
    live_provider: z.enum(LIVE_PROVIDERS).default(cameraConfigDefault.live_provider),
    go2rtc: go2rtcConfigSchema.optional(),
    image: imageBaseConfigSchema.optional().default(imageConfigDefault),
    jsmpeg: jsmpegConfigSchema.optional(),
    webrtc_card: webrtcCardConfigSchema.optional(),

    cast: castSchema.optional(),

    ptz: ptzCameraConfigSchema.default(cameraConfigDefault.ptz),

    dimensions: z
      .object({
        aspect_ratio: aspectRatioSchema.optional(),
        layout: mediaLayoutConfigSchema.optional(),
      })
      .optional(),

    proxy: proxyConfigSchema.default(cameraConfigDefault.proxy),

    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1650
    always_error_if_entity_unavailable: z
      .boolean()
      .default(cameraConfigDefault.always_error_if_entity_unavailable),
  })
  .default(cameraConfigDefault);
export type CameraConfig = z.infer<typeof cameraConfigSchema>;

// Avoid using .nonempty() to avoid changing the inferred type
// (https://github.com/colinhacks/zod#minmaxlength).
const camerasConfigSchema = cameraConfigSchema.array().min(1);
export type CamerasConfig = z.infer<typeof camerasConfigSchema>;

// *************************************************************************
//                         View Configuration
// *************************************************************************

const viewConfigDefault = {
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

const viewConfigSchema = z
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

// *************************************************************************
//                         Menu Configuration
// *************************************************************************

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

const menuConfigDefault = {
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

// *************************************************************************
//                       Status Bar Configuration
// *************************************************************************

const STATUS_BAR_STYLES = [
  'none',
  'overlay',
  'hover',
  'hover-card',
  'outside',
  'popup',
] as const;

const STATUS_BAR_POSITIONS = ['top', 'bottom'] as const;

const statusBarItemDefault = {
  priority: STATUS_BAR_PRIORITY_DEFAULT,
  enabled: true,
};

const statusBarConfigDefault = {
  height: 40,
  items: {
    engine: statusBarItemDefault,
    resolution: statusBarItemDefault,
    technology: statusBarItemDefault,
    title: statusBarItemDefault,
  },
  position: 'bottom' as const,
  style: 'popup' as const,
  popup_seconds: 3,
};

export const statusBarConfigSchema = z
  .object({
    position: z.enum(STATUS_BAR_POSITIONS).default(statusBarConfigDefault.position),
    style: z.enum(STATUS_BAR_STYLES).default(statusBarConfigDefault.style),
    popup_seconds: z
      .number()
      .min(0)
      .max(60)
      .default(statusBarConfigDefault.popup_seconds),
    height: z.number().min(STATUS_BAR_HEIGHT_MIN).default(statusBarConfigDefault.height),
    items: z
      .object({
        engine: statusBarItemBaseSchema.default(statusBarConfigDefault.items.engine),
        technology: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.technology,
        ),
        resolution: statusBarItemBaseSchema.default(
          statusBarConfigDefault.items.resolution,
        ),
        title: statusBarItemBaseSchema.default(statusBarConfigDefault.items.title),
      })
      .default(statusBarConfigDefault.items),
  })
  .default(statusBarConfigDefault);
export type StatusBarConfig = z.infer<typeof statusBarConfigSchema>;

// *************************************************************************
//                       Event Viewer Configuration
// *************************************************************************

const viewerConfigDefault = {
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

const viewerConfigSchema = z
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
      })
      .default(viewerConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(viewerConfigDefault);
export type ViewerConfig = z.infer<typeof viewerConfigSchema>;

// *************************************************************************
//                      Event Gallery Configuration
// *************************************************************************

const galleryThumbnailControlsDefaults = {
  ...thumbnailControlsDefaults,
  show_details: false,
};

const galleryConfigDefault = {
  controls: {
    thumbnails: galleryThumbnailControlsDefaults,
    filter: {
      mode: 'right' as const,
    },
  },
};

const gallerythumbnailsControlSchema = thumbnailsControlSchema.extend({
  show_details: z.boolean().default(galleryThumbnailControlsDefaults.show_details),
});

const galleryConfigSchema = z
  .object({
    controls: z
      .object({
        thumbnails: gallerythumbnailsControlSchema.default(
          galleryConfigDefault.controls.thumbnails,
        ),
        filter: z
          .object({
            mode: z
              .enum(['none', 'left', 'right'])
              .default(galleryConfigDefault.controls.filter.mode),
          })
          .default(galleryConfigDefault.controls.filter),
      })
      .default(galleryConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(galleryConfigDefault);
export type GalleryConfig = z.infer<typeof galleryConfigSchema>;

// *************************************************************************
//                      Dimensions Configuration
// *************************************************************************

const dimensionsConfigDefault = {
  aspect_ratio_mode: 'dynamic' as const,
  aspect_ratio: [16, 9],
  height: 'auto',
};

export const dimensionsConfigSchema = z
  .object({
    aspect_ratio_mode: z
      .enum(['dynamic', 'static', 'unconstrained'])
      .default(dimensionsConfigDefault.aspect_ratio_mode),
    aspect_ratio: aspectRatioSchema.default(dimensionsConfigDefault.aspect_ratio),
    height: z.string().default(dimensionsConfigDefault.height),
  })
  .default(dimensionsConfigDefault);

// *************************************************************************
//                       Override Configuration
// *************************************************************************

const overridesSchema = z
  .object({
    conditions: advancedCameraCardConditionSchema.array(),
    merge: z.object({}).passthrough().optional(),
    set: z.object({}).passthrough().optional(),
    delete: z.string().array().optional(),
  })
  .array()
  .optional();
export type Overrides = z.infer<typeof overridesSchema>;

// *************************************************************************
//                       Automation Configuration
// *************************************************************************

const automationActionSchema = actionConfigSchema.array();
export type AutomationActions = z.infer<typeof automationActionSchema>;

const automationSchema = z
  .object({
    conditions: advancedCameraCardConditionSchema.array(),
    actions: automationActionSchema.optional(),
    actions_not: automationActionSchema.optional(),
  })
  .refine(
    (data) => data.actions?.length || data.actions_not?.length,
    'Automations must include at least one action',
  );
export type Automation = z.infer<typeof automationSchema>;

const automationsSchema = automationSchema.array();

// *************************************************************************
//                       Performance Configuration
// *************************************************************************

const performanceConfigDefault = {
  features: {
    animated_progress_indicator: true,
    card_loading_indicator: true,
    media_chunk_size: MEDIA_CHUNK_SIZE_DEFAULT,
  },
  style: {
    border_radius: true,
    box_shadow: true,
  },
};

export const performanceConfigSchema = z
  .object({
    features: z
      .object({
        animated_progress_indicator: z
          .boolean()
          .default(performanceConfigDefault.features.animated_progress_indicator),
        card_loading_indicator: z
          .boolean()
          .default(performanceConfigDefault.features.card_loading_indicator),
        media_chunk_size: z
          .number()
          .min(0)
          .max(MEDIA_CHUNK_SIZE_MAX)
          .default(performanceConfigDefault.features.media_chunk_size),
        max_simultaneous_engine_requests: z.number().min(1).optional(),
      })
      .default(performanceConfigDefault.features),
    style: z
      .object({
        border_radius: z.boolean().default(performanceConfigDefault.style.border_radius),
        box_shadow: z.boolean().default(performanceConfigDefault.style.box_shadow),
      })
      .default(performanceConfigDefault.style),
  })
  .default(performanceConfigDefault);
export type PerformanceConfig = z.infer<typeof performanceConfigSchema>;

const debugConfigDefault = {
  logging: false,
};

const debugConfigSchema = z
  .object({
    logging: z.boolean().default(debugConfigDefault.logging),
  })
  .default(debugConfigDefault);
type DebugConfig = z.infer<typeof debugConfigSchema>;

// *************************************************************************
//                       CardWideConfig Configuration
// *************************************************************************

export interface CardWideConfig {
  performance?: PerformanceConfig;
  debug?: DebugConfig;
}

// *************************************************************************
//                      *** Profile Configuration ***
// *************************************************************************
const PROFILES = ['casting', 'low-performance', 'scrubbing'] as const;
export type ProfileType = (typeof PROFILES)[number];
export const profilesSchema = z.enum(PROFILES).array().optional();

// *************************************************************************
//                  *** Remote Control Configuration ***
// *************************************************************************

const remoteControlConfigSchema = z
  .object({
    entities: z
      .object({
        camera: z.string().startsWith('input_select.').optional(),
      })
      .optional(),
  })
  .optional();

// *************************************************************************
//                      *** Card Configuration ***
// *************************************************************************

export const advancedCameraCardConfigSchema = z.object({
  // Defaults are stripped out of the individual cameras, since each camera will
  // be merged with `cameras_global` which *does* have defaults. If we didn't do
  // this, the default values of each individual camera would override the
  // intentionally specified values in `cameras_global` during camera
  // initialization when the two configs are merged.
  cameras: deepRemoveDefaults(camerasConfigSchema),
  cameras_global: cameraConfigSchema,

  view: viewConfigSchema,
  menu: menuConfigSchema,
  status_bar: statusBarConfigSchema,
  live: liveConfigSchema,
  media_gallery: galleryConfigSchema,
  media_viewer: viewerConfigSchema,
  image: imageConfigSchema,
  elements: pictureElementsSchema,
  dimensions: dimensionsConfigSchema,
  timeline: timelineConfigSchema,
  performance: performanceConfigSchema,
  debug: debugConfigSchema,
  automations: automationsSchema.optional(),

  profiles: profilesSchema,

  // Configuration overrides.
  overrides: overridesSchema,

  // Support for card_mod (https://github.com/thomasloven/lovelace-card-mod).
  card_mod: z.unknown(),

  // Card ID (used for query string commands). Restrict contents to only values
  // that be easily used in a URL.
  card_id: z.string().regex(cardIDRegex).optional(),

  remote_control: remoteControlConfigSchema,

  // Stock lovelace card config.
  type: z.string(),
});

export type AdvancedCameraCardConfig = z.infer<typeof advancedCameraCardConfigSchema>;
export type RawAdvancedCameraCardConfig = Record<string, unknown>;
export type RawAdvancedCameraCardConfigArray = RawAdvancedCameraCardConfig[];

export const configDefaults = {
  cameras: cameraConfigDefault,
  view: viewConfigDefault,
  menu: menuConfigDefault,
  status_bar: statusBarConfigDefault,
  live: liveConfigDefault,
  media_gallery: galleryConfigDefault,
  media_viewer: viewerConfigDefault,
  image: imageConfigDefault,
  timeline: timelineConfigDefault,
  performance: performanceConfigDefault,
  debug: debugConfigDefault,
};
