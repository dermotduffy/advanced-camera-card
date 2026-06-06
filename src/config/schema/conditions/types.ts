import { z } from 'zod';
import { callConditionSchema } from './custom/call';
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
import { numericStateConditionSchema } from './stock/numeric-state';
import { screenConditionSchema } from './stock/screen';
import { stateConditionSchema } from './stock/state';
import { templateConditionSchema } from './stock/template';
import { userConditionSchema } from './stock/user';

// https://www.home-assistant.io/docs/scripts/conditions/#or-condition
type OrCondition = {
  condition: 'or';
  conditions: Condition[];
};
const orConditionSchema: z.ZodSchema<OrCondition> = z.object({
  condition: z.literal('or'),

  // HA requires the `conditions` key but allows an empty list.
  conditions: z.lazy(() => conditionSchema).array(),
});

// https://www.home-assistant.io/docs/scripts/conditions/#and-condition
type AndCondition = {
  condition: 'and';
  conditions: Condition[];
};
const andConditionSchema: z.ZodSchema<AndCondition> = z.object({
  condition: z.literal('and'),

  // HA requires the `conditions` key but allows an empty list.
  conditions: z.lazy(() => conditionSchema).array(),
});

// https://www.home-assistant.io/docs/scripts/conditions/#not-condition
type NotCondition = {
  condition: 'not';
  conditions: Condition[];
};
const notConditionSchema: z.ZodSchema<NotCondition> = z.object({
  condition: z.literal('not'),

  // HA requires the `conditions` key but allows an empty list.
  conditions: z.lazy(() => conditionSchema).array(),
});

export const conditionSchema = z.union([
  // Stock conditions:
  numericStateConditionSchema,
  screenConditionSchema,
  stateConditionSchema,
  userConditionSchema,
  orConditionSchema,
  andConditionSchema,
  notConditionSchema,
  templateConditionSchema,

  // Custom conditions:
  callConditionSchema,
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
export type Condition = z.infer<typeof conditionSchema>;
