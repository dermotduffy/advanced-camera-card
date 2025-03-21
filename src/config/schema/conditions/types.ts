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
