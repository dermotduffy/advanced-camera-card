import { describe, expect, it } from 'vitest';

import { getMediaSeekTarget } from '../../src/view/media-seek-target';
import { createView, TestViewMedia } from './test-utils';

const START = new Date('2024-01-01T10:00:00');
const END = new Date('2024-01-01T11:00:00');

const createMedia = (): TestViewMedia =>
  new TestViewMedia({ startTime: START, endTime: END });

describe('getMediaSeekTarget', () => {
  it('should target a requested seek within the media', () => {
    const seek = new Date('2024-01-01T10:30:00');

    expect(
      getMediaSeekTarget(
        createView({ context: { mediaViewer: { seek: seek } } }),
        createMedia(),
      ),
    ).toEqual({ time: seek, inMedia: true });
  });

  it('should target a requested seek outside the media', () => {
    const seek = new Date('2024-01-01T12:00:00');

    expect(
      getMediaSeekTarget(
        createView({ context: { mediaViewer: { seek: seek } } }),
        createMedia(),
      ),
    ).toEqual({ time: seek, inMedia: false });
  });

  it('should target the playback start time without a requested seek', () => {
    expect(getMediaSeekTarget(createView(), createMedia())).toEqual({
      time: START,
      inMedia: true,
    });
  });

  it('should target the playback start time without a view', () => {
    expect(getMediaSeekTarget(null, createMedia())).toEqual({
      time: START,
      inMedia: true,
    });
  });

  it('should have no target without a requested seek or playback start time', () => {
    expect(getMediaSeekTarget(createView(), new TestViewMedia())).toBeNull();
  });
});
