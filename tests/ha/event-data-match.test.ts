import { describe, expect, it } from 'vitest';
import { matchesEventData } from '../../src/ha/event-data-match';

describe('matchesEventData', () => {
  describe('non-object data', () => {
    it.each([['string'], [42], [true], [null], [undefined]])(
      'rejects non-object data (%s) with a non-empty filter',
      (data) => {
        expect(matchesEventData({ a: 1 }, data)).toBe(false);
      },
    );
  });

  it('matches when every filter key matches', () => {
    expect(matchesEventData({ command: 'press' }, { command: 'press', extra: 1 })).toBe(
      true,
    );
  });

  it('rejects when a filter value differs', () => {
    expect(matchesEventData({ command: 'press' }, { command: 'release' })).toBe(false);
  });

  it('rejects when a filter key is missing from data', () => {
    expect(matchesEventData({ command: 'press' }, { other: 'press' })).toBe(false);
  });

  it('ignores extra keys in data', () => {
    expect(matchesEventData({ a: 1 }, { a: 1, b: 2, c: 3 })).toBe(true);
  });

  it('matches nested objects as a subset', () => {
    expect(
      matchesEventData(
        { device: { id: 'abc' } },
        { device: { id: 'abc', name: 'Front Door' } },
      ),
    ).toBe(true);
  });

  it('rejects nested objects when a nested key differs', () => {
    expect(matchesEventData({ device: { id: 'abc' } }, { device: { id: 'xyz' } })).toBe(
      false,
    );
  });

  it('matches arrays element-wise', () => {
    expect(matchesEventData({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })).toBe(true);
  });

  it('matches arrays as a subset by index (filter shorter than data)', () => {
    // Same partial-match semantics lodash uses for objects: a shorter filter
    // array matches if every index it specifies matches in data. Useful when
    // the user only cares about the first N values.
    expect(matchesEventData({ tags: ['a'] }, { tags: ['a', 'b'] })).toBe(true);
  });

  it('rejects arrays with mismatched elements at the same index', () => {
    expect(matchesEventData({ tags: ['a', 'c'] }, { tags: ['a', 'b'] })).toBe(false);
  });

  it('rejects when filter array is longer than data array', () => {
    expect(matchesEventData({ tags: ['a', 'b'] }, { tags: ['a'] })).toBe(false);
  });

  it('distinguishes null from undefined', () => {
    expect(matchesEventData({ a: null }, { a: null })).toBe(true);
    expect(matchesEventData({ a: null }, { a: 0 })).toBe(false);
  });

  it('accepts an empty filter against any object', () => {
    expect(matchesEventData({}, {})).toBe(true);
    expect(matchesEventData({}, { anything: 1, nested: { x: 2 } })).toBe(true);
  });
});
