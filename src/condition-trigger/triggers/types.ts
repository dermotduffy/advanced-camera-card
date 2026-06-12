import { HassEntity } from 'home-assistant-js-websocket';
import { AdvancedCameraCardConfig } from '../../config/schema/types';

// The card's trigger-relevant state. The single shape shared by the ambient
// `acc.*` template namespace (current state) and the `trigger.from_acc`/
// `trigger.to_acc` before/after snapshots -- the card analogue of HA's full
// `trigger.from_state`/`to_state` State objects.
// TODO: Don't forget to move this to the templates directory.
export interface AdvancedCameraCardState {
  camera?: string;
  view?: string;
  config?: AdvancedCameraCardConfig;
}

// The top-level `trigger` template variable produced each time a trigger fires.
// `platform` is the provider -- a real HA platform for stock triggers, or `acc`
// for the card's own triggers (whose specific kind is then in `type`, mirroring
// HA's device-trigger platform/type split).
export interface TriggerData {
  platform: string;
  type?: string;

  // Stock (HA-faithful) fields:
  entity_id?: string;
  entity?: string;
  from_state?: HassEntity;
  to_state?: HassEntity;

  // Card (`acc` platform) fields -- full before/after card-state snapshots:
  from_acc?: AdvancedCameraCardState;
  to_acc?: AdvancedCameraCardState;
}
