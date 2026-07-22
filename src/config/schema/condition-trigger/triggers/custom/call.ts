import { z } from 'zod';

import { callPhaseMatchSchema } from '../../common/call';
import { triggerBaseSchema } from '../base';

// Unlike the call condition (which matches a specific phase), the trigger
// matches a phase transition: `from` is checked against the phase before the
// change and `to` against the phase after it. An omitted `from` or `to` is not
// checked, so specifying neither matches any phase change.
export const callTriggerSchema = triggerBaseSchema.extend({
  trigger: z.literal('call'),
  from: callPhaseMatchSchema.optional(),
  to: callPhaseMatchSchema.optional(),
});
