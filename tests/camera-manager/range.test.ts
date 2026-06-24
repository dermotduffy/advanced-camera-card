import { add, sub } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  compressRanges,
  DateRange,
  ExpiringMemoryRangeSet,
  ExpiringRange,
  MemoryRangeSet,
  rangesOverlap,
} from '../../src/camera-manager/range.js';

describe('MemoryRangeSet', () => {
  const rangeSet = new MemoryRangeSet();
  const now = new Date();
  const range: DateRange = {
    start: now,
    end: add(now, { hours: 1 }),
  };

  beforeEach(() => {
    rangeSet.clear();
  });

  it('should have coverage when added', () => {
    rangeSet.add(range);
    expect(rangeSet.hasCoverage(range)).toBeTruthy();
  });
  it('should not have coverage when overlapping', () => {
    rangeSet.add(range);
    expect(rangeSet.hasCoverage({ ...range, end: add(now, { hours: 2 }) })).toBeFalsy();
  });
  it('should not have coverage when non-overlapping', () => {
    rangeSet.add(range);
    expect(
      rangeSet.hasCoverage({
        start: add(now, { hours: 2 }),
        end: add(now, { hours: 3 }),
      }),
    ).toBeFalsy();
  });

  it('should be empty when cleared', () => {
    rangeSet.add(range);
    rangeSet.clear();
    expect(rangeSet.hasCoverage(range)).toBeFalsy();
  });
});

describe('ExpiringMemoryRangeSet', () => {
  const expiringRangeSet = new ExpiringMemoryRangeSet();
  const now = new Date();
  const expiringRange: ExpiringRange<Date> = {
    start: now,
    end: add(now, { hours: 1 }),
    expires: add(now, { hours: 1 }),
  };

  beforeEach(() => {
    expiringRangeSet.clear();
  });

  it('should have coverage when added', () => {
    expiringRangeSet.add(expiringRange);
    expect(expiringRangeSet.hasCoverage(expiringRange)).toBeTruthy();
  });
  it('should not have coverage when overlapping', () => {
    expiringRangeSet.add(expiringRange);
    expect(
      expiringRangeSet.hasCoverage({ ...expiringRange, end: add(now, { hours: 2 }) }),
    ).toBeFalsy();
  });
  it('should not have coverage when non-overlapping', () => {
    expiringRangeSet.add(expiringRange);
    expect(
      expiringRangeSet.hasCoverage({
        start: add(now, { hours: 2 }),
        end: add(now, { hours: 3 }),
      }),
    ).toBeFalsy();
  });
  it('should not have coverage when expired', () => {
    expiringRangeSet.add(expiringRange);

    vi.useFakeTimers();
    vi.setSystemTime(add(now, { hours: 2 }));
    expect(expiringRangeSet.hasCoverage(expiringRange)).toBeFalsy();
    vi.useRealTimers();
  });

  it('should be empty when cleared', () => {
    expiringRangeSet.add(expiringRange);
    expiringRangeSet.clear();
    expect(expiringRangeSet.hasCoverage(expiringRange)).toBeFalsy();
  });
});

describe('rangesOverlap', () => {
  const now = new Date();
  const a: DateRange = {
    start: now,
    end: add(now, { hours: 1 }),
  };

  it('should overlap when A starts within B', () => {
    expect(rangesOverlap(a, { ...a, start: add(now, { minutes: 30 }) })).toBeTruthy();
  });
  it('should overlap when A ends within B', () => {
    expect(rangesOverlap(a, { ...a, end: add(now, { hours: 2 }) })).toBeTruthy();
  });
  it('should overlap when A is entirely within B', () => {
    expect(
      rangesOverlap(a, {
        start: add(now, { minutes: 1 }),
        end: add(now, { minutes: 59 }),
      }),
    ).toBeTruthy();
  });

  it('should not overlap when A is entirely unrelated to B', () => {
    expect(
      rangesOverlap(a, { start: sub(now, { hours: 2 }), end: sub(now, { hours: 1 }) }),
    ).toBeFalsy();
  });
});

describe('compressRanges', () => {
  const now = new Date();
  const nowPlusOne = add(now, { minutes: 1 });
  const nowPlusTwo = add(now, { minutes: 2 });
  const nowPlusThree = add(now, { minutes: 3 });

  it('should compress nearby ranges', () => {
    expect(
      compressRanges([
        { start: now, end: nowPlusOne },
        { start: nowPlusOne, end: nowPlusTwo },
        { start: now, end: nowPlusOne },
      ]),
    ).toEqual([{ start: now, end: nowPlusTwo }]);
  });

  it('should not compress unrelated ranges', () => {
    const input = [
      { start: now, end: nowPlusOne },
      { start: nowPlusTwo, end: nowPlusThree },
    ];
    expect(compressRanges(input)).toEqual(input);
  });

  it('should compress unrelated ranges with large tolerance', () => {
    const input = [
      { start: now, end: nowPlusOne },
      { start: nowPlusTwo, end: nowPlusThree },
    ];
    expect(compressRanges(input, 60 * 60)).toEqual([{ start: now, end: nowPlusThree }]);
  });

  it('should compress number based ranges', () => {
    const input = [
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ];
    expect(compressRanges(input)).toEqual([{ start: 1, end: 3 }]);
  });

  it('should return nothing with no input', () => {
    expect(compressRanges([])).toEqual([]);
  });
});
