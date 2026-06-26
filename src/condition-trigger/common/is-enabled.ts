import type { TemplateRenderer } from '../../card-controller/templates';
import type { ConditionState } from '../conditions/types';

// The shared `enabled` gate for triggers and conditions (equivalent to HA's
// `vol.Any(boolean, template)`): a boolean, or a template rendered against the
// current state. Returns whether the trigger/condition is active.
//
// `fallback` is the result used when a template `enabled` cannot be rendered
// (no hass yet, or the renderer has not finished loading -- both happen at
// startup). It differs by caller because "disabled" has opposite consequences:
// a disabled *trigger* simply does not fire (so triggers fail closed -- pass
// `false`), whereas a disabled *condition* is skipped (so the condition may
// evaluate to `true`).
export const isEnabled = (
  templateRenderer: TemplateRenderer,
  enabled?: boolean | string,
  state?: ConditionState,
  fallback = true,
): boolean => {
  if (enabled === undefined) {
    return true;
  }
  if (typeof enabled === 'boolean') {
    return enabled;
  }
  if (!state?.hass || !templateRenderer.isLoaded()) {
    return fallback;
  }
  return (
    templateRenderer.renderRecursively(state.hass, enabled, {
      conditionState: state,
    }) === true
  );
};
