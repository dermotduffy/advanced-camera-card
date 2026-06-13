import { TemplateRenderer } from '../../card-controller/templates';
import { ConditionState } from '../conditions/types';

// The shared `enabled` gate for triggers and conditions (equivalent to HA's
// `vol.Any(boolean, template)`): a boolean, or a template rendered against the
// current state. Returns whether the trigger/condition is active.
export const isEnabled = (
  templateRenderer: TemplateRenderer,
  enabled?: boolean | string,
  state?: ConditionState,
): boolean => {
  if (enabled === undefined) {
    return true;
  }
  if (typeof enabled === 'boolean') {
    return enabled;
  }
  return (
    !state?.hass ||
    templateRenderer.renderRecursively(state.hass, enabled, {
      conditionState: state,
    }) === true
  );
};
