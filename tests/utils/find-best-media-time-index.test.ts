import { describe, expect, it, vi } from 'vitest';
import { findBestMediaTimeIndex } from '../../src/utils/find-best-media-time-index';
import { ViewFolder } from '../../src/view/item';
import { TestViewMedia } from '../test-utils';

describe('findBestMediaTimeIndex', () => {
  it('should handle non-media items', () => {
    const folder = new ViewFolder({ id: 'folder', type: 'ha', title: 'folder' }, []);
    const media = new TestViewMedia({
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T11:00:00'),
    });

    const index = findBestMediaTimeIndex(
      [folder, media],
      new Date('2024-01-01T10:30:00'),
    );
    expect(index).toBe(1);
  });

  it('should find longest match', () => {
    const media1 = new TestViewMedia({
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:30:00'),
    });
    const media2 = new TestViewMedia({
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T11:00:00'),
    });

    const index = findBestMediaTimeIndex(
      [media1, media2],
      new Date('2024-01-01T10:15:00'),
    );
    expect(index).toBe(1);
  });

  it('should favor specified camera', () => {
    const media1 = new TestViewMedia({
      cameraID: 'camera1',
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T11:00:00'),
    });
    const media2 = new TestViewMedia({
      cameraID: 'camera2',
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:30:00'),
    });

    // Even though media1 is longer, favor media2's camera.
    const index = findBestMediaTimeIndex(
      [media1, media2],
      new Date('2024-01-01T10:15:00'),
      'camera2',
    );
    expect(index).toBe(1);
  });

  it('should handle multiple matches from non-favored cameras', () => {
    const media1 = new TestViewMedia({
      cameraID: 'camera1',
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:30:00'),
    });
    const media2 = new TestViewMedia({
      cameraID: 'camera3',
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T11:00:00'),
    });

    const index = findBestMediaTimeIndex(
      [media1, media2],
      new Date('2024-01-01T10:15:00'),
      'camera2', // Favored camera not present
    );
    expect(index).toBe(1); // Longest match wins
  });

  it('should handle missing start or end time', () => {
    const media = new TestViewMedia({
      startTime: null,
      endTime: null,
    });
    vi.spyOn(media, 'includesTime').mockReturnValue(true);

    const index = findBestMediaTimeIndex([media], new Date());
    expect(index).toBeNull();
  });

  it('should return null when no match', () => {
    const media = new TestViewMedia({
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T11:00:00'),
    });
    const index = findBestMediaTimeIndex([media], new Date('2024-01-01T12:00:00'));
    expect(index).toBeNull();
  });

  it('should reject longer match if favored camera already matched', () => {
    const media1 = new TestViewMedia({
      cameraID: 'favored',
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:30:00'),
    });
    const media2 = new TestViewMedia({
      cameraID: 'not-favored',
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T11:00:00'),
    });

    // media2 is longer, but media1 is favored and already matches.
    const index = findBestMediaTimeIndex(
      [media1, media2],
      new Date('2024-01-01T10:15:00'),
      'favored',
    );
    expect(index).toBe(0);
  });
});
