import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  getMediaDetails,
  getMediaHeading,
  getMediaSeekDetail,
} from '../../../src/components-lib/media/detail';
import { formatDateAndTime } from '../../../src/utils/basic';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import { createCameraManagerWithMetadata } from '../../camera-manager/test-utils';
import { createFolder } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

describe('getMediaHeading', () => {
  it('should head an event with what it detected and the score', () => {
    const item = new TestViewMedia({
      what: ['person', 'car'],
      tags: ['tag1', 'tag2'],
      score: 0.5,
    });

    expect(getMediaHeading({ item })?.text).toBe('Person, Car 50%');
  });

  it('should omit a score the event does not have', () => {
    const item = new TestViewMedia({
      what: ['person', 'car'],
    });

    expect(getMediaHeading({ item })?.text).toBe('Person, Car');
  });

  it('should have no heading for an event with only tags', () => {
    const item = new TestViewMedia({
      tags: ['tag1', 'tag2'],
    });

    expect(getMediaHeading({ item })).toBeNull();
  });

  it('should have no heading for an event with no other information', () => {
    const item = new TestViewMedia({
      mediaType: ViewMediaType.Snapshot,
      what: null,
      tags: null,
      score: null,
    });

    expect(getMediaHeading({ item })).toBeNull();
  });

  it('should head a recording with its camera title', () => {
    const item = new TestViewMedia({
      mediaType: ViewMediaType.Recording,
    });

    expect(
      getMediaHeading({
        cameraManager: createCameraManagerWithMetadata({
          title: 'Camera Title',
          icon: { icon: 'mdi:cow' },
        }),
        item,
      })?.text,
    ).toBe('Camera Title');
  });

  it('should have no heading for a recording without camera metadata', () => {
    const item = new TestViewMedia({
      mediaType: ViewMediaType.Recording,
    });

    expect(getMediaHeading({ item })).toBeNull();
  });

  it('should have no heading for a folder', () => {
    expect(getMediaHeading({ item: new ViewFolder(createFolder(), []) })).toBeNull();
  });

  it('should head media with its title when nothing shorter names it', () => {
    const item = new TestViewMedia({
      cameraID: null,
      title: 'Test Event',
    });

    expect(getMediaHeading({ item })?.text).toBe('Test Event');
  });

  it('should head a review with its severity', () => {
    const item = new TestViewMedia({
      mediaType: ViewMediaType.Review,
      title: 'Review Title',
      severity: 'high',
    });

    expect(getMediaHeading({ item })).toEqual({
      text: 'Review Title',
      severity: 'high',
      icon: 'mdi:circle-medium',
      tooltip: 'Severity: High',
    });
  });

  it('should head a review that has no severity', () => {
    const item = new TestViewMedia({
      mediaType: ViewMediaType.Review,
      title: 'Review Title',
      severity: null,
    });

    const heading = getMediaHeading({ item });

    expect(heading?.text).toBe('Review Title');
    expect(heading?.severity).toBeUndefined();
  });

  it('should have no heading for a review with no title', () => {
    const item = new TestViewMedia({
      mediaType: ViewMediaType.Review,
      title: null,
    });

    expect(getMediaHeading({ item })).toBeNull();
  });

  it('should have no heading without an item', () => {
    expect(getMediaHeading({})).toBeNull();
  });
});

describe('getMediaDetails', () => {
  it('should have the start time', () => {
    const startTime = new Date('2025-05-18T17:03:00Z');
    const item = new TestViewMedia({ startTime });

    expect(getMediaDetails({ item })).toContainEqual({
      text: formatDateAndTime(startTime, true),
      tooltip: 'Start',
      icon: 'mdi:calendar-clock-outline',
    });
  });

  describe('should have the duration', () => {
    it('should have the duration of finished media', () => {
      const item = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
        endTime: new Date('2025-05-18T17:04:00Z'),
      });

      expect(getMediaDetails({ item })).toContainEqual({
        text: '1m 0s',
        tooltip: 'Duration',
        icon: 'mdi:clock-outline',
      });
    });

    it('should say media with no end time is still in progress', () => {
      const item = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
        endTime: null,
        inProgress: true,
      });

      expect(getMediaDetails({ item })).toContainEqual({
        text: 'In progress...',
        tooltip: 'Duration',
        icon: 'mdi:clock-outline',
      });
    });

    it('should say how long media in progress has run for', () => {
      const item = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
        endTime: new Date('2025-05-18T17:04:00Z'),
        inProgress: true,
      });

      expect(getMediaDetails({ item })).toContainEqual({
        text: '1m 0s In progress...',
        tooltip: 'Duration',
        icon: 'mdi:clock-outline',
      });
    });
  });

  it('should have the camera title', () => {
    const item = new TestViewMedia({ cameraID: 'camera_1' });

    expect(
      getMediaDetails({
        cameraManager: createCameraManagerWithMetadata({
          title: 'Camera Title',
          icon: { icon: 'mdi:cow' },
        }),
        item,
      }),
    ).toContainEqual({
      text: 'Camera Title',
      tooltip: 'Camera',
      icon: 'mdi:cctv',
    });
  });

  it('should have where the media was taken', () => {
    const item = new TestViewMedia({
      cameraID: 'camera_1',
      where: ['where1', 'where2'],
    });

    expect(getMediaDetails({ item })).toContainEqual({
      text: 'Where1, Where2',
      tooltip: 'Where',
      icon: 'mdi:map-marker-outline',
    });
  });

  it('should have the tags', () => {
    const item = new TestViewMedia({
      cameraID: 'camera_1',
      tags: ['tag1', 'tag2'],
    });

    expect(getMediaDetails({ item })).toContainEqual({
      text: 'Tag1, Tag2',
      tooltip: 'Tag',
      icon: 'mdi:tag',
    });
  });

  it('should not repeat the title the heading already names the media with', () => {
    const item = new TestViewMedia({
      cameraID: null,
      title: 'Test Event',
    });

    expect(getMediaDetails({ item })).not.toContainEqual(
      expect.objectContaining({ text: 'Test Event' }),
    );
  });

  it('should have nothing without an item', () => {
    expect(getMediaDetails({})).toEqual([]);
  });
});

describe('getMediaSeekDetail', () => {
  it('should have a detail for a seek time', () => {
    const seek = new Date('2025-05-20T07:14:57Z');

    expect(getMediaSeekDetail(seek)).toEqual({
      text: format(seek, 'HH:mm:ss'),
      tooltip: 'Seek',
      icon: 'mdi:clock-fast',
    });
  });

  it('should have no detail without a seek time', () => {
    expect(getMediaSeekDetail()).toBeNull();
  });
});
