import { z } from 'zod';
import { callTriggerSchema } from './custom/call';
import { cameraTriggerSchema } from './custom/camera';
import { configTriggerSchema } from './custom/config';
import { displayModeTriggerSchema } from './custom/display-mode';
import { expandTriggerSchema } from './custom/expand';
import { fullscreenTriggerSchema } from './custom/fullscreen';
import { initializedTriggerSchema } from './custom/initialized';
import { interactionTriggerSchema } from './custom/interaction';
import { keyTriggerSchema } from './custom/key';
import { mediaLoadedTriggerSchema } from './custom/media-loaded';
import { microphoneTriggerSchema } from './custom/microphone';
import { screenTriggerSchema } from './custom/screen';
import { triggeredTriggerSchema } from './custom/triggered';
import { userTriggerSchema } from './custom/user';
import { userAgentTriggerSchema } from './custom/user-agent';
import { viewTriggerSchema } from './custom/view';
import { numericStateTriggerSchema } from './stock/numeric-state';
import { stateTriggerSchema } from './stock/state';
import { templateTriggerSchema } from './stock/template';

export const triggerSchema = z.union([
  // Stock triggers (HA automation triggers):
  numericStateTriggerSchema,
  stateTriggerSchema,
  templateTriggerSchema,

  // Custom triggers (Note: `screen`/`user` are HA picture elements conditions
  // but have no HA trigger equivalent):
  callTriggerSchema,
  cameraTriggerSchema,
  configTriggerSchema,
  displayModeTriggerSchema,
  expandTriggerSchema,
  fullscreenTriggerSchema,
  initializedTriggerSchema,
  interactionTriggerSchema,
  keyTriggerSchema,
  mediaLoadedTriggerSchema,
  microphoneTriggerSchema,
  screenTriggerSchema,
  triggeredTriggerSchema,
  userTriggerSchema,
  userAgentTriggerSchema,
  viewTriggerSchema,
]);
export type Trigger = z.infer<typeof triggerSchema>;
