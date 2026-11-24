import { describe, expect, it } from 'vitest';

import { getDurationString } from '../../../src/utils/date/duration';

describe('getDurationString', () => {
  it('should return duration', () => {
    const start = new Date(2023, 3, 14, 13, 35, 0);
    const end = new Date(2023, 3, 14, 15, 37, 20);
    expect(getDurationString(start, end)).toBe('2h 2m 20s');
  });
  it('should return very short duration', () => {
    const start = new Date(2023, 3, 14, 13, 35, 10);
    const end = new Date(2023, 3, 14, 13, 35, 12);
    expect(getDurationString(start, end)).toBe('2s');
  });
  it('should return 0s for no delta', () => {
    const start = new Date(2023, 3, 14, 13, 35, 10);
    expect(getDurationString(start, start)).toBe('0s');
  });
});
