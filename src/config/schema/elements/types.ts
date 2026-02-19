import { z } from 'zod';
import {
  statusBarIconItemSchema,
  statusBarImageItemSchema,
  statusBarStringItemSchema,
} from '../actions/types';
import { stockConditionSchema } from '../conditions/stock/types';
import { advancedCameraCardConditionSchema } from '../conditions/types';
import { menuIconSchema } from './custom/menu/icon';
import { menuStateIconSchema } from './custom/menu/state-icon';
import { menuSubmenuSchema } from './custom/menu/submenu';
import { menuSubmenuSelectSchema } from './custom/menu/submenu-select';
import { customSchema } from './stock/custom';
import { iconSchema } from './stock/icon';
import { imageSchema } from './stock/image';
import { serviceCallButtonSchema } from './stock/service-call';
import { stateBadgeIconSchema } from './stock/state-badge';
import { stateIconSchema } from './stock/state-icon';
import { stateLabelSchema } from './stock/state-label';

// Condition elements are included in this upper file as they recursively
// include other elements. Putting these elements elsewhere would cause
// typescript circular dependency errors as the types need to be both included
// in the master pictureElementSchema, but also refer to it internally.

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
export const conditionalSchema = z.object({
  type: z.literal('conditional'),
  conditions: stockConditionSchema.array(),

  get elements() {
    // Recursive schema.
    return pictureElementsSchema;
  },
});

const advancedCameraCardConditionalSchema = z.object({
  type: z.literal('custom:advanced-camera-card-conditional'),
  conditions: advancedCameraCardConditionSchema.array(),

  get elements() {
    // Recursive schema.
    return pictureElementsSchema;
  },
});
export type AdvancedCameraCardConditional = z.infer<
  typeof advancedCameraCardConditionalSchema
>;

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

export const pictureElementsSchema = pictureElementSchema.array().optional().default([]);
export type PictureElements = z.infer<typeof pictureElementsSchema>;
