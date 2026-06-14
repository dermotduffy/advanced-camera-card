import { TemplateAdvancedCameraCardState } from '../../card-controller/templates/types';
import { ConditionState, ConditionStateChange } from '../conditions/types';
import { TriggerData } from './types';

// The card-state snapshot (`from_acc`/`to_acc`) surfaced by card triggers: the
// card's own camera/view/config at a point in time.
const getTriggerState = (state: ConditionState): TemplateAdvancedCameraCardState => ({
  ...(state.camera !== undefined && { camera: state.camera }),
  ...(state.view !== undefined && { view: state.view }),
  ...(state.config !== undefined && { config: state.config }),
});

// Assemble the `acc`-platform payload for a card trigger: its `type` plus the
// before/after card-state snapshots (each omitted when it carries nothing).
export const buildCardTriggerData = (
  type: string,
  stateChange?: ConditionStateChange,
): TriggerData => {
  const data: TriggerData = { platform: 'acc', type };
  if (!stateChange) {
    return data;
  }
  const from = getTriggerState(stateChange.old);
  const to = getTriggerState(stateChange.new);
  return {
    ...data,
    ...(Object.keys(from).length && { from_acc: from }),
    ...(Object.keys(to).length && { to_acc: to }),
  };
};
