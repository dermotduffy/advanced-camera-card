import type { TemplateRenderer } from '../../card-controller/templates';
import type { NumericStateBase } from '../../config/schema/condition-trigger/common/numeric-state';
import type { ConditionState } from '../conditions/types';

// The numeric value of `entityID` to compare: the rendered `value_template`,
// else the `attribute`, else the state. Returns null when the entity is absent
// or the value is non-numeric (the cases where HA raises a ConditionError).
export const readNumericStateValue = (
  entityID: string,
  state: ConditionState,
  config: NumericStateBase,
  templateRenderer: TemplateRenderer,
): number | null => {
  const hass = state.hass;
  if (!hass) {
    return null;
  }
  const stateObj = hass.states?.[entityID];
  if (!stateObj) {
    return null;
  }

  let rawValue: unknown;
  if (config.value_template) {
    // Until the renderer has loaded the template cannot be evaluated; treat as
    // non-numeric (so the match fails) rather than parsing a raw `{{…}}`.
    if (!templateRenderer.isLoaded()) {
      return null;
    }
    rawValue = templateRenderer.renderRecursively(hass, config.value_template, {
      conditionState: state,
    });
  } else if (config.attribute !== undefined) {
    rawValue = stateObj.attributes?.[config.attribute];
  } else {
    rawValue = stateObj.state;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
};

// Whether `entityID`'s numeric value currently satisfies the `above`/`below`
// thresholds. A threshold is a number, or an entity id whose state supplies it;
// an unspecified threshold imposes no constraint and an unresolvable one fails.
// Shared by the numeric_state condition and trigger, which match identically.
export const matchesNumericState = (
  entityID: string,
  state: ConditionState,
  config: NumericStateBase,
  templateRenderer: TemplateRenderer,
): boolean => {
  const hass = state.hass;
  if (!hass) {
    return false;
  }
  const value = readNumericStateValue(entityID, state, config, templateRenderer);
  if (value === null) {
    return false;
  }

  const checkBound = (
    compare: (value: number, bound: number) => boolean,
    threshold?: number | string,
  ): boolean => {
    if (threshold === undefined) {
      return true;
    }
    const bound =
      typeof threshold === 'number'
        ? threshold
        : Number(hass.states?.[threshold]?.state);
    return Number.isFinite(bound) && compare(value, bound);
  };

  return (
    checkBound((v, bound) => v > bound, config.above) &&
    checkBound((v, bound) => v < bound, config.below)
  );
};
