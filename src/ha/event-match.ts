import type { HassEventBase } from 'home-assistant-js-websocket';
import { isEqualWith } from 'lodash-es';

import type { HAEventContextFilter } from '../config/schema/common/ha-event';
import { isRecord } from '../utils/basic';

// A plain object (HA/Python `dict`), excluding arrays -- the distinction HA's
// event trigger keys off when deciding how to match a value.
const isDict = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && !Array.isArray(value);

// Deep equality matching Python's `==`: identical to a normal deep-equal except
// that Python's `bool` is a subtype of `int`, so `true`/`false` equal `1`/`0`
// (and that equivalence propagates through nested lists/dicts). HA relies on
// it, so we must too for byte-for-byte parity.
export const haEqual = (a: unknown, b: unknown): boolean =>
  isEqualWith(a, b, (x, y) => {
    if (typeof x === 'boolean' && typeof y === 'number') {
      return Number(x) === y;
    }
    if (typeof x === 'number' && typeof y === 'boolean') {
      return x === Number(y);
    }
    return undefined;
  });

// Matches HA's event-trigger `event_data` filtering precisely, including its
// fast-path/slow-path split (homeassistant/components/homeassistant/triggers/
// event.py):
//
//  - If NO top-level filter value is a dict, HA does a plain items-subset
//    compare (`event.items() >= filter.items()`): every filter key must be
//    present with an equal value (`haEqual`; lists by order + length).
//  - If ANY top-level filter value is a dict, HA validates the event against
//    `vol.Schema(filter, extra=ALLOW_EXTRA, required=True)` instead: every
//    filter key is required (recursively into nested dicts), extra keys are
//    allowed at every level, and a list filter is matched by voluptuous
//    membership -- each event-array element must equal one of the filter
//    array's entries (order/length-free). Scalars match by equality.
//
// The asymmetry is real: the same top-level list filter is strict in the fast
// path but membership-matched in the slow path (when a sibling key is a dict).
// The `unknown` guard lives here because event payloads arrive untyped from the
// WebSocket bus.
// https://github.com/home-assistant/core/blob/dev/homeassistant/components/homeassistant/triggers/event.py
export const matchesEventData = (
  filter: Record<string, unknown>,
  data: unknown,
): boolean => {
  if (!isRecord(data)) {
    return false;
  }

  if (!Object.values(filter).some(isDict)) {
    // Fast path: strict items subset.
    return Object.entries(filter).every(
      ([key, expected]) => key in data && haEqual(data[key], expected),
    );
  }

  // Slow path: `vol.Schema(filter, extra=ALLOW_EXTRA, required=True)`.
  return matchesSchemaDict(filter, data);
};

// A voluptuous dict schema with `required=True, extra=ALLOW_EXTRA`: every schema
// key must be present and recursively match; extra event keys are allowed.
const matchesSchemaDict = (schema: Record<string, unknown>, value: unknown): boolean =>
  isDict(value) &&
  Object.entries(schema).every(
    ([key, expected]) => key in value && matchesSchemaValue(expected, value[key]),
  );

const matchesSchemaValue = (expected: unknown, actual: unknown): boolean => {
  if (isDict(expected)) {
    return matchesSchemaDict(expected, actual);
  }
  if (Array.isArray(expected)) {
    // voluptuous list schema: `actual` must be a list whose every element
    // matches one of the filter's element schemas.
    return (
      Array.isArray(actual) &&
      actual.every((item) => expected.some((schema) => matchesSchemaValue(schema, item)))
    );
  }
  return haEqual(actual, expected);
};

// HA-faithful match for the event `context` object: every defined filter field
// must match the event's corresponding field by equality (scalar filter) or
// list-membership (array filter). A null event-side field never satisfies an
// explicit filter, mirroring HA's behaviour.
// https://www.home-assistant.io/docs/automation/trigger/#event-trigger
export const matchesEventContext = (
  filter: HAEventContextFilter,
  context: HassEventBase['context'],
): boolean =>
  matchesContextField(filter.id, context.id) &&
  matchesContextField(filter.user_id, context.user_id) &&
  matchesContextField(filter.parent_id, context.parent_id);

const matchesContextField = (
  expected: string | string[] | undefined,
  actual: string | null,
): boolean => {
  if (expected === undefined) {
    return true;
  }
  if (actual === null) {
    return false;
  }
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
};
