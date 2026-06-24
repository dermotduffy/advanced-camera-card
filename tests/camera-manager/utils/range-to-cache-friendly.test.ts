import { describe, expect, it, vi } from 'vitest';

import { convertRangeToCacheFriendlyTimes } from '../../../src/camera-manager/utils/range-to-cache-friendly';

describe('convertRangeToCacheFriendlyTimes', () => {
  it('should return cache friendly within hour range', () => {
    expect(
      convertRangeToCacheFriendlyTimes({
        start: new Date('2023-04-29T14:01:02'),
        end: new Date('2023-04-29T14:11:03'),
      }),
    ).toEqual({
      start: new Date('2023-04-29T14:00:00'),
      end: new Date('2023-04-29T14:59:59.999'),
    });
  });

  it('should return cache friendly within day range', () => {
    expect(
      convertRangeToCacheFriendlyTimes({
        start: new Date('2023-04-29T14:01:02'),
        end: new Date('2023-04-29T15:11:03'),
      }),
    ).toEqual({
      start: new Date('2023-04-29T00:00:00'),
      end: new Date('2023-04-29T23:59:59.999'),
    });
  });

  it('should cap end date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-04-29T14:25'));
    expect(
      convertRangeToCacheFriendlyTimes(
        {
          start: new Date('2023-04-29T14:01:02'),
          end: new Date('2023-04-29T14:11:03'),
        },
        { endCap: true },
      ),
    ).toEqual({
      start: new Date('2023-04-29T14:00:00'),
      end: new Date('2023-04-29T14:25:59.999'),
    });
    vi.useRealTimers();
  });
});
