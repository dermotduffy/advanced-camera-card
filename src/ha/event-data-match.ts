import { isMatch } from 'lodash-es';
import { isRecord } from '../utils/basic';

// Deep subset match between an HA bus event's payload `data` and a user-
// configured filter. Mirrors HA automation `event_data` semantics: every key in
// `filter` must exist in `data` and recursively match; extra keys in `data` are
// ignored. The `unknown` guard lives here (not at the caller) because HA event
// payloads arrive untyped from the WebSocket bus.
export const matchesEventData = (
  filter: Record<string, unknown>,
  data: unknown,
): boolean => isRecord(data) && isMatch(data, filter);
