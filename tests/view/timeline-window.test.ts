import { describe, expect, it } from 'vitest';

import {
  getTimelinePrefetchWindow,
  getTimelineQueryRange,
} from '../../src/view/timeline-window';

describe('getTimelinePrefetchWindow', () => {
  it('should widen the window by its own width on each side', () => {
    expect(
      getTimelinePrefetchWindow({
        start: new Date('2026-11-26T10:00:00'),
        end: new Date('2026-11-26T11:00:00'),
      }),
    ).toEqual({
      start: new Date('2026-11-26T09:00:00'),
      end: new Date('2026-11-26T12:00:00'),
    });
  });
});

describe('getTimelineQueryRange', () => {
  it('should round a prefetch window longer than an hour out to whole days', () => {
    expect(
      getTimelineQueryRange({
        start: new Date('2026-11-26T10:00:00'),
        end: new Date('2026-11-26T11:00:00'),
      }),
    ).toEqual({
      start: new Date('2026-11-26T00:00:00'),
      end: new Date('2026-11-26T23:59:59.999'),
    });
  });

  it('should round a prefetch window of up to an hour out to whole hours', () => {
    expect(
      getTimelineQueryRange({
        start: new Date('2026-11-26T10:20:00'),
        end: new Date('2026-11-26T10:30:00'),
      }),
    ).toEqual({
      start: new Date('2026-11-26T10:00:00'),
      end: new Date('2026-11-26T10:59:59.999'),
    });
  });
});
