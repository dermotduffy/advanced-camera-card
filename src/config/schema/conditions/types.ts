import { z } from 'zod';
import { cameraConditionSchema } from './custom/camera';
import { configConditionSchema } from './custom/config';
import { displayModeConditionSchema } from './custom/display-mode';
import { expandConditionSchema } from './custom/expand';
import { fullscreenConditionSchema } from './custom/fullscreen';
import { initializedConditionSchema } from './custom/initialized';
import { interactionConditionSchema } from './custom/interaction';
import { keyConditionSchema } from './custom/key';
import { mediaLoadedConditionSchema } from './custom/media-loaded';
import { microphoneConditionSchema } from './custom/microphone';
import { triggeredConditionSchema } from './custom/triggered';
import { userAgentConditionSchema } from './custom/user-agent';
import { viewConditionSchema } from './custom/view';
import { numericStateConditionSchema } from './stock/numeric';
import { screenConditionSchema } from './stock/screen';
import { stateConditionSchema } from './stock/state';
import { usersConditionSchema } from './stock/users';

// https://www.home-assistant.io/docs/scripts/conditions/#or-condition
type OrCondition = {
  condition: 'or';
  conditions: AdvancedCameraCardCondition[];
};
const orConditionSchema: z.ZodSchema<OrCondition> = z.object({
  condition: z.literal('or'),
  conditions: z
    .lazy(() => advancedCameraCardConditionSchema)
    .array()
    .min(1),
});

// https://www.home-assistant.io/docs/scripts/conditions/#and-condition
type AndCondition = {
  condition: 'and';
  conditions: AdvancedCameraCardCondition[];
};
const andConditionSchema: z.ZodSchema<AndCondition> = z.object({
  condition: z.literal('and'),
  conditions: z
    .lazy(() => advancedCameraCardConditionSchema)
    .array()
    .min(1),
});

// https://www.home-assistant.io/docs/scripts/conditions/#not-condition
type NotCondition = {
  condition: 'not';
  conditions: AdvancedCameraCardCondition[];
};
const notConditionSchema: z.ZodSchema<NotCondition> = z.object({
  condition: z.literal('not'),
  conditions: z
    .lazy(() => advancedCameraCardConditionSchema)
    .array()
    .min(1),
});

export const advancedCameraCardConditionSchema = z.union([
  // Stock conditions:
  numericStateConditionSchema,
  screenConditionSchema,
  stateConditionSchema,
  usersConditionSchema,
  orConditionSchema,
  andConditionSchema,
  notConditionSchema,

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
