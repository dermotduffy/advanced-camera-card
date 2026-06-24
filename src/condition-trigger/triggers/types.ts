import { HassEntity, HassEvent } from 'home-assistant-js-websocket';

import { TemplateAdvancedCameraCardState } from '../../card-controller/templates/types';

// The top-level `trigger` template variable produced each time an evaluator
// triggers. `platform` is the provider -- a real HA platform for stock
// triggers, or `acc` for the card's own triggers (whose specific kind is then
// in `type`, mirroring HA's device-trigger platform/type split).
export interface TriggerData {
  platform: string;
  type?: string;

  // Stock (HA-faithful) fields:
  entity_id?: string;
  entity?: string;
  from_state?: HassEntity;
  to_state?: HassEntity;

  // For `platform: 'event'` (HA event trigger) -- the full HA event, surfaced
  // as `trigger.event.*` to mirror HA's event-trigger template variables.
  event?: HassEvent;

  // Card (`acc` platform) fields -- full before/after card-state trigger data:
  from_acc?: TemplateAdvancedCameraCardState;
  to_acc?: TemplateAdvancedCameraCardState;
}
