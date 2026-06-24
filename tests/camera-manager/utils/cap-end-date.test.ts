import { describe, expect, it, vi } from 'vitest';

import { capEndDate } from '../../../src/camera-manager/utils/cap-end-date';

describe('capEndDate', () => {
  it('should cap end date', () => {
    const fakeNow = new Date('2023-04-29T14:25');
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);

    expect(capEndDate(new Date('2023-04-29T15:02'))).toEqual(fakeNow);

    vi.useRealTimers();
  });

  it('should not cap end date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-04-29T14:25'));

    const testDate = new Date('2023-04-29T14:24');
    expect(capEndDate(testDate)).toEqual(testDate);

    vi.useRealTimers();
  });
});
