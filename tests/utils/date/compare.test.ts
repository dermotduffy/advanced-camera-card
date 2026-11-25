import { describe, expect, it } from 'vitest';

import { getEarliestDate } from '../../../src/utils/date/compare';

describe('getEarliestDate', () => {
  it('should return the earliest date', () => {
    const earliest = new Date('2026-06-05T22:56:56Z');
    expect(
      getEarliestDate(
        new Date('2026-06-05T22:57:00Z'),
        earliest,
        new Date('2026-06-06'),
      ),
    ).toBe(earliest);
  });
  it('should skip absent dates', () => {
    const date = new Date('2026-06-05T22:56:56Z');
    expect(getEarliestDate(null, date, undefined)).toBe(date);
  });
  it('should return null without dates', () => {
    expect(getEarliestDate()).toBeNull();
    expect(getEarliestDate(null, undefined)).toBeNull();
  });
});
