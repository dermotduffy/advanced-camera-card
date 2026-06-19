import { z } from 'zod';
import { linkSchema } from '../common/link';
import { preprocessToArray } from '../common/preprocess-to-array';
import { severitySchema } from '../common/severity';
import { statusBarItemBaseSchema } from '../common/status-bar';
import { Condition, conditionSchema } from '../condition-trigger/conditions/types';
import { actionBaseSchema } from './base';
import { advancedCameraCardCustomActionsBaseSchema } from './custom/base';
import { callAnswerActionConfigSchema } from './custom/call-answer';
import { callEndActionConfigSchema } from './custom/call-end';
import { callStartActionConfigSchema } from './custom/call-start';
import { cameraSelectActionConfigSchema } from './custom/camera-select';
import { viewDisplayModeActionConfigSchema } from './custom/display-mode';
import { effectActionConfigSchema } from './custom/effect';
import { generalActionConfigSchema } from './custom/general';
import { internalCallbackActionConfigSchema } from './custom/internal';
import { logActionConfigSchema } from './custom/log';
import { mediaPlayerActionConfigSchema } from './custom/media-player';
import { ptzActionConfigSchema } from './custom/ptz';
import { ptzControlsActionConfigSchema } from './custom/ptz-controls';
import { ptzDigitalActionConfigSchema } from './custom/ptz-digital';
import { ptzMultiActionSchema } from './custom/ptz-multi';
import { setReviewActionConfigSchema } from './custom/set-review';
import { sleepActionConfigSchema } from './custom/sleep';
import { substreamOffActionConfigSchema } from './custom/substream-off';
import { substreamOnActionConfigSchema } from './custom/substream-on';
import { viewActionConfigSchema } from './custom/view';
import { callServiceActionSchema } from './stock/call-service';
import { customActionSchema } from './stock/custom';
import { moreInfoActionSchema } from './stock/more-info';
import { navigateActionSchema } from './stock/navigate';
import { noneActionSchema } from './stock/none';
import { performActionActionSchema } from './stock/perform-action';
import { toggleActionSchema } from './stock/toggle';
import { urlActionSchema } from './stock/url';

// ============================================================================
// The Notification, Status Bar, and `if`/`then`/`else` action schemas are
// co-located here because their content references actionConfigSchema (creating
// a circular dep). Each uses z.lazy + a manual type annotation to break the
// cycle and preserve correct type inference.
// See: https://zod.dev/?id=recursive-types
// ============================================================================

export type NotificationActionConfig = z.infer<
  typeof advancedCameraCardCustomActionsBaseSchema
> & {
  advanced_camera_card_action: 'notification';
  notification: Notification;
};
const notificationActionConfigSchema: z.ZodSchema<NotificationActionConfig> =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('notification'),
    notification: z.lazy(() => notificationSchema),
  });

export type StatusBarActionConfig = z.infer<
  typeof advancedCameraCardCustomActionsBaseSchema
> & {
  advanced_camera_card_action: 'status_bar';
  status_bar_action: 'add' | 'remove' | 'reset';
  items?: StatusBarItem[];
};
export const statusBarActionConfigSchema: z.ZodSchema<StatusBarActionConfig> =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal('status_bar'),
    status_bar_action: z.enum(['add', 'remove', 'reset']),
    items: z
      .lazy(() => statusBarItemSchema)
      .array()
      .optional(),
  });

const advancedCameraCardCustomActionSchema = z.union([
  callAnswerActionConfigSchema,
  callEndActionConfigSchema,
  callStartActionConfigSchema,
  cameraSelectActionConfigSchema,
  effectActionConfigSchema,
  generalActionConfigSchema,
  internalCallbackActionConfigSchema,
  logActionConfigSchema,
  mediaPlayerActionConfigSchema,
  notificationActionConfigSchema,
  ptzActionConfigSchema,
  ptzControlsActionConfigSchema,
  ptzDigitalActionConfigSchema,
  ptzMultiActionSchema,
  setReviewActionConfigSchema,
  sleepActionConfigSchema,
  statusBarActionConfigSchema,
  substreamOffActionConfigSchema,
  substreamOnActionConfigSchema,
  viewActionConfigSchema,
  viewDisplayModeActionConfigSchema,
]);
export type AdvancedCameraCardCustomActionConfig = z.infer<
  typeof advancedCameraCardCustomActionSchema
>;

// HA `if`/`then`/`else` script action: unlike most actions this has no `action:`
// key, and is identified by the presence of an `if` key. `then`/`else` reference
// actionConfigSchema recursively, so it uses z.lazy to break the cycle.
export type IfActionConfig = z.infer<typeof actionBaseSchema> & {
  if: Condition[];
  then: ActionConfig[];
  else?: ActionConfig[];
};
const ifActionConfigSchema: z.ZodSchema<IfActionConfig> = actionBaseSchema.extend({
  if: preprocessToArray(conditionSchema.array()),
  then: preprocessToArray(z.lazy(() => actionConfigSchema).array()),
  else: preprocessToArray(z.lazy(() => actionConfigSchema).array()).optional(),
});

// The HA stock actions. Assembled here, rather than in a `stock/` file, because
// it includes the recursive `if` action above (which must live in this module).
const stockActionSchema = z.union([
  callServiceActionSchema,
  customActionSchema,
  ifActionConfigSchema,
  moreInfoActionSchema,
  navigateActionSchema,
  noneActionSchema,
  performActionActionSchema,
  toggleActionSchema,
  urlActionSchema,
]);

// The specific custom schemas must come *before* the stock union: the latter
// contains `customActionSchema`, a loose `action: fire-dom-event` catch-all
// that would otherwise match (and shadow) every specific custom action,
// dropping their defaults and validation.
export const actionConfigSchema = z.union([
  advancedCameraCardCustomActionSchema,
  stockActionSchema,
]);
export type ActionConfig = z.infer<typeof actionConfigSchema>;

export const actionsBaseSchema = z
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
  .loose();
export type Actions = z.infer<typeof actionsBaseSchema>;

export interface AuxillaryActionConfig {
  entity?: string;
}

export type ActionsConfig = Actions & AuxillaryActionConfig;

export const actionsSchema = z.object({
  actions: actionsBaseSchema.optional(),
});

// ============================================================================
//                         Notification Elements
//
// Note: Notification schemas are defined here (after actionsBaseSchema) so
// controls can directly reference actionsBaseSchema without z.lazy.
// ============================================================================

const notificationBaseSchema = z.object({
  icon: z.string().optional(),
  tooltip: z.string().optional(),
  severity: severitySchema.optional(),
});

const notificationDetailSchema = notificationBaseSchema.extend({
  text: z.string(),
});
export type NotificationDetail = z.infer<typeof notificationDetailSchema>;

const notificationControlSchema = notificationBaseSchema.extend({
  actions: actionsBaseSchema.optional(),
  dismiss: z.boolean().default(true),
});
export type NotificationControl = z.infer<typeof notificationControlSchema>;

const notificationSchema = z.object({
  heading: notificationDetailSchema.optional(),
  body: notificationDetailSchema.optional(),
  metadata: notificationDetailSchema.array().optional(),
  context: z.string().array().optional(),
  link: linkSchema.optional(),
  in_progress: z.boolean().optional(),
  controls: notificationControlSchema.array().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;

// ============================================================================
//                         Status Bar Elements
//
// Note: Status Bar action & elements are included in this file, since this is
// the only action that may include content that refers to *other* actions (e.g.
// a status bar action, compromises of status bar items, which themselves may
// have actions). This circular relationship means the components must be
// together in a file, or they will generate typescript circular dependency
// errors.
// ============================================================================

const statusBarItemElementsBaseSchema = statusBarItemBaseSchema.extend({
  sufficient: z.boolean().default(false).optional(),
  exclusive: z.boolean().default(false).optional(),
  expand: z.boolean().default(false).optional(),
  severity: severitySchema.optional(),
  title: z.string().optional(),
  actions: actionsBaseSchema.optional(),
});

export const statusBarIconItemSchema = statusBarItemElementsBaseSchema.extend({
  type: z.literal('custom:advanced-camera-card-status-bar-icon'),
  icon: z.string(),
});
export type StatusBarIcon = z.infer<typeof statusBarIconItemSchema>;

export const statusBarImageItemSchema = statusBarItemElementsBaseSchema.extend({
  type: z.literal('custom:advanced-camera-card-status-bar-image'),
  image: z.string(),
});
export type StatusBarImage = z.infer<typeof statusBarImageItemSchema>;

export const statusBarStringItemSchema = statusBarItemElementsBaseSchema.extend({
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
