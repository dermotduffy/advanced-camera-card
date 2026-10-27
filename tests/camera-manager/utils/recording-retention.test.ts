import { add, sub } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { expandRangeByRetentionMargin } from '../../../src/camera-manager/utils/recording-retention';

describe('expandRangeByRetentionMargin', () => {
  it('should keep one hour on either side', () => {
    const start = new Date('2026-03-14T20:00:00Z');
    const end = new Date('2026-03-14T21:00:00Z');

    expect(expandRangeByRetentionMargin({ start, end })).toEqual({
      start: sub(start, { hours: 1 }),
      end: add(end, { hours: 1 }),
    });
  });

  it('should honor a margin chosen in the timeline settings', () => {
    const start = new Date('2026-03-14T20:00:00Z');
    const end = new Date('2026-03-14T21:00:00Z');

    expect(expandRangeByRetentionMargin({ start, end }, 4)).toEqual({
      start: sub(start, { hours: 4 }),
      end: add(end, { hours: 4 }),
    });
  });
});
