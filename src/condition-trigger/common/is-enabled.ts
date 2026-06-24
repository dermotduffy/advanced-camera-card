import type { TemplateRenderer } from '../../card-controller/templates';
import type { ConditionState } from '../conditions/types';

// The shared `enabled` gate for triggers and conditions (equivalent to HA's
// `vol.Any(boolean, template)`): a boolean, or a template rendered against the
// current state. Returns whether the trigger/condition is active.
//
// `enabledWithoutHass` is the fallback when a template `enabled` cannot be
// rendered (no hass yet, e.g. at startup). It differs by caller because
// "disabled" has opposite consequences: a disabled *trigger* simply does not
// fire (so triggers fail closed -- pass `false`), whereas a disabled
// *condition* is skipped (so the condition may evaluate to `true`)
export const isEnabled = (
  templateRenderer: TemplateRenderer,
  enabled?: boolean | string,
  state?: ConditionState,
  enabledWithoutHass = true,
): boolean => {
  if (enabled === undefined) {
    return true;
  }
  if (typeof enabled === 'boolean') {
    return enabled;
  }
  if (!state?.hass) {
    return enabledWithoutHass;
  }
  return (
    templateRenderer.renderRecursively(state.hass, enabled, {
      conditionState: state,
    }) === true
  );
};
