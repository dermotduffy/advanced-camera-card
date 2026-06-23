import { z } from 'zod';
import { haEventSchema } from '../../../common/ha-event';
import { triggerBaseSchema } from '../base';

// Subscribes to one or more Home Assistant bus event types and fires every time
// a matching event arrives. `event_type`, `event_data` and `context` filters
// mirror HA's native fields exactly.
// https://www.home-assistant.io/docs/automation/trigger/#event-trigger
export const eventTriggerSchema = triggerBaseSchema.extend(haEventSchema.shape).extend({
  trigger: z.literal('event'),
});
