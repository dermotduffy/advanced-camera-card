import { add } from 'date-fns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingID,
  getRecordingMediaContentID,
  getRecordingTitle,
  getReviewMediaContentID,
  getReviewPlaybackStartTime,
  getReviewSeverity,
  getReviewThumbnailURL,
  getReviewTitle,
} from '../../../src/camera-manager/frigate/util';
import type { CameraConfig } from '../../../src/config/schema/cameras';
import { createCameraConfig } from '../../config/test-utils';
import {
  createFrigateEvent,
  createFrigateRecording,
  createFrigateReview,
} from '../../test-utils';

describe('getEventTitle', () => {
  const start = new Date('2023-05-06T10:43:00');
  const end = new Date('2023-05-06T10:44:12');
  afterEach(() => {
    vi.useRealTimers();
  });
  it('should get finished event title', () => {
    expect(
      getEventTitle(
        createFrigateEvent({
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          top_score: 0.841796875,
          label: 'person',
        }),
      ),
    ).toBe('2023-05-06 10:43 [72s, Person 84%]');
  });
  it('should get in-progress event title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(add(start, { seconds: 60 }));

    expect(
      getEventTitle(
        createFrigateEvent({
          start_time: start.getTime() / 1000,
          end_time: null,
          top_score: 0.841796875,
          label: 'person',
        }),
      ),
    ).toBe('2023-05-06 10:43 [60s, Person 84%]');
  });
  it('should get scoreless event title', () => {
    expect(
      getEventTitle(
        createFrigateEvent({
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          top_score: null,
          label: 'person',
        }),
      ),
    ).toBe('2023-05-06 10:43 [72s, Person]');
  });
});

describe('getRecordingTitle', () => {
  it('should get recording title', () => {
    expect(
      getRecordingTitle(
        'Kitchen',
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00'),
        }),
      ),
    ).toBe('Kitchen 2023-04-29 14:00');
  });
});

describe('getEventThumbnailURL', () => {
  it('should get thumbnail URL', () => {
    expect(
      getEventThumbnailURL(
        'clientid',
        createFrigateEvent({
          id: '1683396875.643998-hmzrh5',
        }),
      ),
    ).toBe('/api/frigate/clientid/thumbnail/1683396875.643998-hmzrh5');
  });
});

describe('getEventMediaContentID', () => {
  it('should get event content ID', () => {
    expect(
      getEventMediaContentID(
        'clientid',
        'kitchen',
        createFrigateEvent({
          id: '1683396875.643998-hmzrh5',
        }),
        'clips',
      ),
    ).toBe(
      'media-source://frigate/clientid/event/clips/kitchen/1683396875.643998-hmzrh5',
    );
  });
});

describe('getRecordingMediaContentID', () => {
  it('should get recording content ID', () => {
    expect(
      getRecordingMediaContentID(
        'clientid',
        'kitchen',
        createFrigateRecording({
          startTime: new Date('2023-04-29T18:00:00Z'),
        }),
        'America/New_York',
      ),
    ).toBe('media-source://frigate/clientid/recordings/kitchen/2023-04-29/14');
  });

  it('should get recording content ID in the given timezone', () => {
    expect(
      getRecordingMediaContentID(
        'clientid',
        'kitchen',
        createFrigateRecording({
          startTime: new Date('2023-04-29T18:00:00Z'),
        }),
        'America/Chicago',
      ),
    ).toBe('media-source://frigate/clientid/recordings/kitchen/2023-04-29/13');
  });
});

describe('getRecordingID', () => {
  it('should get recording ID', () => {
    expect(
      getRecordingID(
        createCameraConfig({
          frigate: {
            client_id: 'unique_client_id',
            camera_name: 'kitchen',
          },
        }),
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00Z'),
          endTime: new Date('2023-04-29T14:59:59Z'),
        }),
      ),
    ).toBe('unique_client_id/kitchen/1682776800000/1682780399000');
  });
  it('should get recording ID without client_id or camera_name', () => {
    // Note: This path is defended against in the code but should not happen in
    // practice as this would be a malformed (not-zod-parsed) camera config.
    const cameraConfig = mock<CameraConfig>();
    expect(
      getRecordingID(
        cameraConfig,
        createFrigateRecording({
          startTime: new Date('2023-04-29T14:00:00Z'),
          endTime: new Date('2023-04-29T14:59:59Z'),
        }),
      ),
    ).toBe('//1682776800000/1682780399000');
  });
});

describe('getReviewTitle', () => {
  const start = new Date('2023-05-06T10:43:00');
  const end = new Date('2023-05-06T10:44:12');

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should get finished review title without objects', () => {
    expect(
      getReviewTitle(
        createFrigateReview({
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          data: {
            objects: [],
            zones: [],
          },
        }),
      ),
    ).toBe('2023-05-06 10:43 [72s]');
  });

  it('should get finished review title with objects', () => {
    expect(
      getReviewTitle(
        createFrigateReview({
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          data: {
            objects: ['person', 'dog'],
          },
        }),
      ),
    ).toBe('Person, Dog');
  });

  it('should append sub_labels as tags after objects', () => {
    expect(
      getReviewTitle(
        createFrigateReview({
          data: {
            objects: ['bird-verified'],
            sub_labels: ['Mourning Dove'],
          },
        }),
      ),
    ).toBe('Bird: Mourning Dove');
  });

  it('should strip -verified suffix from objects', () => {
    expect(
      getReviewTitle(
        createFrigateReview({
          data: {
            objects: ['bird-verified', 'person'],
          },
        }),
      ),
    ).toBe('Bird, Person');
  });

  it('should fall back to sub_labels when objects are absent', () => {
    expect(
      getReviewTitle(
        createFrigateReview({
          data: {
            sub_labels: ['John'],
          },
        }),
      ),
    ).toBe('John');
  });

  it('should get in-progress review title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(add(start, { seconds: 60 }));

    expect(
      getReviewTitle(
        createFrigateReview({
          start_time: start.getTime() / 1000,
          end_time: null,
          data: {
            objects: [],
          },
        }),
      ),
    ).toBe('2023-05-06 10:43 [60s]');
  });
});

describe('getReviewMediaContentID', () => {
  it('should get review content ID', () => {
    expect(
      getReviewMediaContentID(
        'clientid',
        'kitchen',
        createFrigateReview({
          start_time: new Date('2023-04-29T18:00:00Z').getTime() / 1000,
        }),
        'America/New_York',
      ),
    ).toBe('media-source://frigate/clientid/recordings/kitchen/2023-04-29/14');
  });

  it('should get review content ID in the given timezone', () => {
    expect(
      getReviewMediaContentID(
        'clientid',
        'kitchen',
        createFrigateReview({
          start_time: new Date('2023-04-29T18:00:00Z').getTime() / 1000,
        }),
        'America/Chicago',
      ),
    ).toBe('media-source://frigate/clientid/recordings/kitchen/2023-04-29/13');
  });
});

describe('getReviewPlaybackStartTime', () => {
  it('should include five seconds of pre-review playback', () => {
    expect(
      getReviewPlaybackStartTime(
        createFrigateReview({
          start_time: new Date('2026-03-14T20:15:00Z').getTime() / 1000,
        }),
        'UTC',
      ),
    ).toEqual(new Date('2026-03-14T20:14:55Z'));
  });

  it('should not pad before the start of the review recording hour', () => {
    expect(
      getReviewPlaybackStartTime(
        createFrigateReview({
          start_time: new Date('2026-03-14T20:00:03Z').getTime() / 1000,
        }),
        'UTC',
      ),
    ).toEqual(new Date('2026-03-14T20:00:00Z'));
  });

  it('should find the start of the hour in the given timezone', () => {
    const review = createFrigateReview({
      start_time: new Date('2026-03-14T18:30:03Z').getTime() / 1000,
    });

    // 18:30:03 UTC is 00:00:03 in Kolkata (UTC+5:30), so the padding is clamped
    // to the start of that hour rather than reaching back into the previous
    // recording.
    expect(getReviewPlaybackStartTime(review, 'Asia/Kolkata')).toEqual(
      new Date('2026-03-14T18:30:00Z'),
    );

    // In UTC the same instant is 30 minutes into the hour, leaving room for the
    // full padding.
    expect(getReviewPlaybackStartTime(review, 'UTC')).toEqual(
      new Date('2026-03-14T18:29:58Z'),
    );
  });
});

describe('getReviewThumbnailURL', () => {
  it('should get thumbnail URL', () => {
    expect(
      getReviewThumbnailURL(
        'clientid',
        createFrigateReview({
          thumb_path: '/media/frigate/thumb.jpg',
        }),
      ),
    ).toBe('/api/frigate/clientid/thumb.jpg');
  });

  it('should return null when no thumb path', () => {
    expect(
      getReviewThumbnailURL(
        'clientid',
        createFrigateReview({
          thumb_path: null,
        }),
      ),
    ).toBeNull();
  });
});

describe('getReviewSeverity', () => {
  it('should get alert severity', () => {
    expect(getReviewSeverity('alert')).toBe('high');
  });
  it('should get detection severity', () => {
    expect(getReviewSeverity('detection')).toBe('medium');
  });
});
