import { z } from 'zod';

import { preprocessToArray } from '../../common/preprocess-to-array';
import { conditionBaseSchema } from './base';
import { expandCompositeShorthand } from './composite';
import { callConditionSchema } from './custom/call';
import { cameraConditionSchema } from './custom/camera';
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

type CompositeCondition = z.infer<typeof conditionBaseSchema> & {
  conditions: Condition[];
};

// https://www.home-assistant.io/docs/scripts/conditions/#or-condition
type OrCondition = CompositeCondition & { condition: 'or' };
const orConditionSchema: z.ZodType<OrCondition> = conditionBaseSchema.extend({
  condition: z.literal('or'),

  // HA requires the `conditions` key but allows an empty list, and accepts a
  // single condition in place of a list (`cv.ensure_list`).
  conditions: preprocessToArray(z.lazy(() => conditionSchema).array()),
});

// https://www.home-assistant.io/docs/scripts/conditions/#and-condition
type AndCondition = CompositeCondition & { condition: 'and' };
const andConditionSchema: z.ZodType<AndCondition> = conditionBaseSchema.extend({
  condition: z.literal('and'),

  // HA requires the `conditions` key but allows an empty list, and accepts a
  // single condition in place of a list (`cv.ensure_list`).
  conditions: preprocessToArray(z.lazy(() => conditionSchema).array()),
});

// https://www.home-assistant.io/docs/scripts/conditions/#not-condition
type NotCondition = CompositeCondition & { condition: 'not' };
const notConditionSchema: z.ZodType<NotCondition> = conditionBaseSchema.extend({
  condition: z.literal('not'),

  // HA requires the `conditions` key but allows an empty list, and accepts a
  // single condition in place of a list (`cv.ensure_list`).
  conditions: preprocessToArray(z.lazy(() => conditionSchema).array()),
});

// The raw union of all condition members. `conditionSchema` wraps this with the
// shorthand preprocess; this is exported only for schema introspection.
export const conditionUnion = z.union([
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

export const conditionSchema = z.preprocess(expandCompositeShorthand, conditionUnion);
export type Condition = z.infer<typeof conditionSchema>;
