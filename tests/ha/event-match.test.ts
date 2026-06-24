import type { HassEventBase } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { matchesEventContext, matchesEventData } from '../../src/ha/event-match';

const ctx = (
  overrides: Partial<HassEventBase['context']> = {},
): HassEventBase['context'] => ({
  id: 'ctx-id',
  user_id: null,
  parent_id: null,
  ...overrides,
});

describe('matchesEventData', () => {
  // Without a nested dict, HA does a plain items-subset compare -- every filter
  // key present, values strictly equal.
  describe('no nested dict in the filter', () => {
    it.each([['string'], [42], [true], [null], [undefined]])(
      'should reject non-object data (%s)',
      (data) => {
        expect(matchesEventData({ a: 1 }, data)).toBe(false);
      },
    );

    it('should match when every filter key matches, ignoring extra data keys', () => {
      expect(
        matchesEventData({ command: 'press' }, { command: 'press', extra: 1 }),
      ).toBe(true);
    });

    it('should reject when a filter value differs', () => {
      expect(matchesEventData({ command: 'press' }, { command: 'release' })).toBe(false);
    });

    it('should reject when a filter key is missing from data', () => {
      expect(matchesEventData({ command: 'press' }, { other: 'press' })).toBe(false);
    });

    it('should distinguish null from a different scalar', () => {
      expect(matchesEventData({ a: null }, { a: null })).toBe(true);
      expect(matchesEventData({ a: null }, { a: 0 })).toBe(false);
    });

    it('should accept an empty filter against any object', () => {
      expect(matchesEventData({}, {})).toBe(true);
      expect(matchesEventData({}, { anything: 1 })).toBe(true);
    });

    // HA's test_event_data_with_list: top-level lists are strict (order+length).
    it('should match a top-level list by strict equality', () => {
      expect(matchesEventData({ tags: [1, 2] }, { tags: [1, 2] })).toBe(true);
    });

    it('should reject a top-level list that is a superset, subset, or scalar', () => {
      expect(matchesEventData({ tags: [1, 2] }, { tags: [1, 2, 3] })).toBe(false);
      expect(matchesEventData({ tags: [1, 2] }, { tags: [1] })).toBe(false);
      expect(matchesEventData({ tags: [1, 2] }, { tags: 1 })).toBe(false);
    });

    // Python's `bool` is a subtype of `int`, so HA equates true/false with 1/0.
    it('should equate booleans with 0/1 (Python ==)', () => {
      expect(matchesEventData({ flag: true }, { flag: 1 })).toBe(true);
      expect(matchesEventData({ flag: 1 }, { flag: true })).toBe(true);
      expect(matchesEventData({ flag: false }, { flag: 0 })).toBe(true);
      expect(matchesEventData({ flag: true }, { flag: 2 })).toBe(false);
      expect(matchesEventData({ flag: 2 }, { flag: true })).toBe(false);
      expect(matchesEventData({ flag: true }, { flag: 'on' })).toBe(false);
    });
  });

  // A nested dict makes HA validate the whole filter via voluptuous
  // (extra=ALLOW_EXTRA, required=True).
  describe('nested dict in the filter', () => {
    // HA's test_if_fires_on_event_with_nested_data: nested dicts are
    // subset-matched -- listed keys required, extra keys allowed.
    it('should allow extra keys inside a nested object', () => {
      expect(
        matchesEventData(
          { device: { id: 'abc' } },
          { device: { id: 'abc', name: 'Front Door' } },
        ),
      ).toBe(true);
    });

    it('should match a nested object with exact contents', () => {
      expect(
        matchesEventData({ device: { id: 'abc' } }, { device: { id: 'abc' } }),
      ).toBe(true);
    });

    it('should reject a nested object missing a required key', () => {
      expect(matchesEventData({ device: { id: 'abc' } }, { device: { x: 'abc' } })).toBe(
        false,
      );
    });

    it('should reject a nested object when a value differs', () => {
      expect(
        matchesEventData({ device: { id: 'abc' } }, { device: { id: 'xyz' } }),
      ).toBe(false);
    });

    it('should reject when the event value is not an object', () => {
      expect(matchesEventData({ device: { id: 'abc' } }, { device: 'abc' })).toBe(false);
    });

    // HA's test_event_data_with_list_nested: nested lists are
    // membership-matched -- every event element must be one of the filter
    // array's entries.
    it('should match a nested list by membership', () => {
      const filter = { svc: { tags: [1, 2] } };
      expect(matchesEventData(filter, { svc: { tags: [1, 2] } })).toBe(true);
      expect(matchesEventData(filter, { svc: { tags: [1] } })).toBe(true);
    });

    it('should reject a nested list with an element outside the filter set', () => {
      expect(
        matchesEventData({ svc: { tags: [1, 2] } }, { svc: { tags: [1, 2, 3] } }),
      ).toBe(false);
    });

    it('should reject a nested list when the event value is not a list', () => {
      expect(matchesEventData({ svc: { tags: [1, 2] } }, { svc: { tags: 1 } })).toBe(
        false,
      );
      expect(
        matchesEventData({ svc: { tags: [1, 2] } }, { svc: { other: [1, 2] } }),
      ).toBe(false);
    });

    it('should membership-match a sibling top-level list given a nested dict', () => {
      expect(matchesEventData({ meta: {}, tags: [1, 2] }, { meta: {}, tags: [1] })).toBe(
        true,
      );
    });

    // The Python bool/int equivalence also propagates through the slow path.
    it('should equate booleans with 0/1 inside nested structures', () => {
      expect(
        matchesEventData({ device: { armed: true } }, { device: { armed: 1 } }),
      ).toBe(true);
      expect(matchesEventData({ meta: {}, vals: [true] }, { meta: {}, vals: [1] })).toBe(
        true,
      );
    });
  });
});

describe('matchesEventContext', () => {
  it('should accept any context when the filter is empty', () => {
    expect(matchesEventContext({}, ctx())).toBe(true);
  });

  it('should match a scalar filter against an equal value', () => {
    expect(matchesEventContext({ id: 'ctx-id' }, ctx({ id: 'ctx-id' }))).toBe(true);
  });

  it('should reject a scalar filter when the value differs', () => {
    expect(matchesEventContext({ id: 'other' }, ctx({ id: 'ctx-id' }))).toBe(false);
  });

  it('should match a list filter when the value is a member', () => {
    expect(matchesEventContext({ id: ['ctx-id', 'other'] }, ctx({ id: 'ctx-id' }))).toBe(
      true,
    );
  });

  it('should reject a list filter when the value is not a member', () => {
    expect(matchesEventContext({ id: ['a', 'b'] }, ctx({ id: 'ctx-id' }))).toBe(false);
  });

  it('should reject when an explicit filter targets a null event field', () => {
    expect(matchesEventContext({ user_id: 'u1' }, ctx({ user_id: null }))).toBe(false);
  });

  it('should AND across multiple filter fields', () => {
    const event = ctx({ id: 'i', user_id: 'u', parent_id: 'p' });
    expect(matchesEventContext({ id: 'i', user_id: 'u', parent_id: 'p' }, event)).toBe(
      true,
    );
    expect(
      matchesEventContext({ id: 'i', user_id: 'u', parent_id: 'OTHER' }, event),
    ).toBe(false);
  });

  it('should ignore undefined filter fields', () => {
    expect(
      matchesEventContext({ id: undefined, user_id: 'u' }, ctx({ user_id: 'u' })),
    ).toBe(true);
  });
});
