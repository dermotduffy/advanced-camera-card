import type { TemplateRenderer } from '../../card-controller/templates';
import type { TimePeriod } from '../../config/schema/common/time-period';
import { isRecord } from '../../utils/basic';
import type { ConditionState } from '../conditions/types';

// Parses a Home Assistant time-period value (a condition/trigger `for:`) to
// seconds, matching HA's `cv.time_period`:
//   - a number, or a bare numeric string, is a count of seconds;
//   - a colon string is `HH:MM` or `HH:MM:SS` -- HA reads TWO parts as
//     hours:minutes (not minutes:seconds);
//   - a `{days, hours, minutes, seconds, milliseconds}` dict (each field a
//     number or a numeric string, e.g. once a template field has been rendered).
// Accepts `unknown` so a freshly-rendered value can be parsed directly; returns
// null when unparseable or negative (HA `for:` requires a positive period).
const parseTimePeriodToSeconds = (value: unknown): number | null => {
  const num = (field: unknown): number => Number(field ?? 0);
  let seconds: number;
  if (typeof value === 'number') {
    seconds = value;
  } else if (typeof value === 'string') {
    if (value.includes(':')) {
      const parts = value.split(':');
      if (parts.length < 2 || parts.length > 3 || parts.some((part) => !part.trim())) {
        return null;
      }
      const [hours, minutes, secs = 0] = parts.map(Number);
      seconds = hours * 3600 + minutes * 60 + secs;
    } else if (!value.trim()) {
      return null;
    } else {
      seconds = Number(value);
    }
  } else if (isRecord(value)) {
    seconds =
      num(value.days) * 86400 +
      num(value.hours) * 3600 +
      num(value.minutes) * 60 +
      num(value.seconds) +
      num(value.milliseconds) / 1000;
  } else {
    return null;
  }
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

// Renders any templates within a `for:` time period (HA's
// `cv.positive_time_period_template`) against the current state, then parses it
// to seconds. The whole value or any dict field may be a template; a
// template-free value renders to itself. Without `hass` the value cannot be
// rendered, so it is parsed as-is (a literal duration still works; a template
// yields null).
export const renderTimePeriodToSeconds = (
  templateRenderer: TemplateRenderer,
  value: TimePeriod,
  conditionState?: ConditionState,
): number | null => {
  if (!conditionState?.hass) {
    return parseTimePeriodToSeconds(value);
  }
  return parseTimePeriodToSeconds(
    templateRenderer.renderRecursively(conditionState.hass, value, { conditionState }),
  );
};
