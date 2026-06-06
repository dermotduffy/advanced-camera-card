import { TimePeriod } from '../config/schema/common/time-period';

// Parses a Home Assistant time-period value (a condition/trigger `for:`) to
// seconds, matching HA's `cv.time_period`:
//   - a number, or a bare numeric string, is a count of seconds;
//   - a colon string is `HH:MM` or `HH:MM:SS` — HA reads TWO parts as
//     hours:minutes (not minutes:seconds);
//   - a `{days, hours, minutes, seconds, milliseconds}` dict.
// Returns null when unparseable or negative (HA `for:` requires a positive period).
export const parseTimePeriodToSeconds = (value: TimePeriod): number | null => {
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
  } else {
    seconds =
      (value.days ?? 0) * 86400 +
      (value.hours ?? 0) * 3600 +
      (value.minutes ?? 0) * 60 +
      (value.seconds ?? 0) +
      (value.milliseconds ?? 0) / 1000;
  }
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};
