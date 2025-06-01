import { z } from 'zod';
import { statusBarItemBaseSchema } from '../common/status-bar';
import { advancedCameraCardCustomActionsBaseSchema } from './custom/base';
import { cameraSelectActionConfigSchema } from './custom/camera-select';
import { viewDisplayModeActionConfigSchema } from './custom/display-mode';
import { foldersViewActionConfigSchema } from './custom/folders-view';
import { generalActionConfigSchema } from './custom/general';
import { internalCallbackActionConfigSchema } from './custom/internal';
import { logActionConfigSchema } from './custom/log';
import { mediaPlayerActionConfigSchema } from './custom/media-player';
import { ptzActionConfigSchema } from './custom/ptz';
import { ptzControlsActionConfigSchema } from './custom/ptz-controls';
import { ptzDigitalActionConfigSchema } from './custom/ptz-digital';
import { ptzMultiActionSchema } from './custom/ptz-multi';
import { sleepActionConfigSchema } from './custom/sleep';
import { substreamSelectActionConfigSchema } from './custom/substream-select';
import { viewActionConfigSchema } from './custom/view';
import { stockActionSchema } from './stock/types';

// Provide a manual type definition to avoid the `any` that would be created by
// the lazy() evaluation below.
// See: https://zod.dev/?id=recursive-types
export type StatusBarActionConfig = z.infer<
  typeof advancedCameraCardCustomActionsBaseSchema
> & {
  advanced_camera_card_action: 'status_bar';
  status_bar_action: 'add' | 'remove' | 'reset';
  items?: StatusBarItem[];
};
export const statusBarActionConfigSchema: z.ZodSchema<
  StatusBarActionConfig,
  z.ZodTypeDef,
  unknown
> = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('status_bar'),
  status_bar_action: z.enum(['add', 'remove', 'reset']),
  items: z
    .lazy(() => statusBarItemSchema)
    .array()
    .optional(),
});

const advancedCameraCardCustomActionSchema = z.union([
  cameraSelectActionConfigSchema,
  foldersViewActionConfigSchema,
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

export const actionConfigSchema = z.union([
  stockActionSchema,
  advancedCameraCardCustomActionSchema,
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
  .passthrough();
export type Actions = z.infer<typeof actionsBaseSchema>;

export interface AuxillaryActionConfig {
  entity?: string;
}

export type ActionsConfig = Actions & AuxillaryActionConfig;

export const actionsSchema = z.object({
  actions: actionsBaseSchema.optional(),
});

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
