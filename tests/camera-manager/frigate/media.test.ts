import { describe, expect, it } from 'vitest';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
  FrigateReviewViewMedia,
  FrigateViewMediaFactory,
} from '../../../src/camera-manager/frigate/media';
import { ViewMediaType } from '../../../src/view/item';
import {
  createCameraConfig,
  createFrigateEvent,
  createFrigateRecording,
  createFrigateReview,
} from '../../test-utils';

describe('FrigateEventViewMedia', () => {
  it('should get start time', () => {
    const event = createFrigateEvent({ start_time: 1683395000 });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getStartTime()).toEqual(new Date(1683395000 * 1000));
  });

  it('should get end time', () => {
    const event = createFrigateEvent({ end_time: 1683397124 });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getEndTime()).toEqual(new Date(1683397124 * 1000));
  });

  it('should get null end time when null', () => {
    const event = createFrigateEvent({ end_time: null });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getEndTime()).toBeNull();
  });

  it('should report in progress when no end time', () => {
    const event = createFrigateEvent({ end_time: null });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.inProgress()).toBe(true);
  });

  it('should report not in progress when end time exists', () => {
    const event = createFrigateEvent({ end_time: 1683397124 });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.inProgress()).toBe(false);
  });

  it('should get video content type as HLS', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent(),
      'content_id',
      'thumbnail',
    );
    expect(media.getVideoContentType()).toBe('hls');
  });

  it('should get ID', () => {
    const event = createFrigateEvent({
      id: 'test-event-id',
    });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getID()).toBe('test-event-id');
  });

  it('should get content ID', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent(),
      'my-content-id',
      'thumbnail',
    );
    expect(media.getContentID()).toBe('my-content-id');
  });

  it('should get title', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent(),
      'content_id',
      'thumbnail',
    );
    expect(media.getTitle()).toBeTruthy();
  });

  it('should get description when present', () => {
    const event = createFrigateEvent({
      data: { description: 'A person walking' },
    });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getDescription()).toBe('A person walking');
  });

  it('should get null description when absent', () => {
    const event = createFrigateEvent();
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getDescription()).toBeNull();
  });

  it('should get thumbnail', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent(),
      'content_id',
      'my-thumb',
    );
    expect(media.getThumbnail()).toBe('my-thumb');
  });

  it('should get favorite status', () => {
    const event = createFrigateEvent({
      retain_indefinitely: true,
    });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.isFavorite()).toBe(true);
  });

  it('should get null favorite when undefined', () => {
    const event = createFrigateEvent();
    delete (event as Record<string, unknown>).retain_indefinitely;
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.isFavorite()).toBeNull();
  });

  it('should set favorite', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent({ retain_indefinitely: false }),
      'content_id',
      'thumbnail',
    );
    media.setFavorite(true);
    expect(media.isFavorite()).toBe(true);
  });

  it('should get what', () => {
    const event = createFrigateEvent({ label: 'cat' });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getWhat()).toEqual(['cat']);
  });

  it('should get where when zones present', () => {
    const event = createFrigateEvent({
      zones: ['front_yard'],
    });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getWhere()).toEqual(['front_yard']);
  });

  it('should get null where when no zones', () => {
    const event = createFrigateEvent({ zones: [] });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getWhere()).toBeNull();
  });

  it('should get score', () => {
    const event = createFrigateEvent({
      top_score: 0.95,
    });
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      event,
      'content_id',
      'thumbnail',
    );
    expect(media.getScore()).toBe(0.95);
  });

  it('should get tags from sub-labels', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent(),
      'content_id',
      'thumbnail',
      ['Amazon', 'UPS'],
    );
    expect(media.getTags()).toEqual(['Amazon', 'UPS']);
  });

  it('should get null tags when no sub-labels', () => {
    const media = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent(),
      'content_id',
      'thumbnail',
    );
    expect(media.getTags()).toBeNull();
  });

  it('should be groupable with same type and criteria', () => {
    const media1 = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent({
        label: 'person',
        zones: ['yard'],
      }),
      'c1',
      't1',
    );
    const media2 = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent({
        label: 'person',
        zones: ['yard'],
      }),
      'c2',
      't2',
    );
    expect(media1.isGroupableWith(media2)).toBe(true);
  });

  it('should not be groupable with different type', () => {
    const media1 = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent({ label: 'person' }),
      'c1',
      't1',
    );
    const media2 = new FrigateEventViewMedia(
      ViewMediaType.Snapshot,
      'camera',
      createFrigateEvent({ label: 'person' }),
      'c2',
      't2',
    );
    expect(media1.isGroupableWith(media2)).toBe(false);
  });

  it('should not be groupable with different label', () => {
    const media1 = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent({ label: 'person' }),
      'c1',
      't1',
    );
    const media2 = new FrigateEventViewMedia(
      ViewMediaType.Clip,
      'camera',
      createFrigateEvent({ label: 'car' }),
      'c2',
      't2',
    );
    expect(media1.isGroupableWith(media2)).toBe(false);
  });
});

describe('FrigateRecordingViewMedia', () => {
  it('should get ID', () => {
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording(),
      'rec-id',
      'content_id',
      'title',
    );
    expect(media.getID()).toBe('rec-id');
  });

  it('should get start time', () => {
    const startTime = new Date('2023-04-29T14:00:00');
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording({ startTime }),
      'id',
      'content_id',
      'title',
    );
    expect(media.getStartTime()).toEqual(startTime);
  });

  it('should get end time', () => {
    const endTime = new Date('2023-04-29T14:59:59');
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording({ endTime }),
      'id',
      'content_id',
      'title',
    );
    expect(media.getEndTime()).toEqual(endTime);
  });

  it('should report not in progress', () => {
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording(),
      'id',
      'content_id',
      'title',
    );
    expect(media.inProgress()).toBe(false);
  });

  it('should get video content type as HLS', () => {
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording(),
      'id',
      'content_id',
      'title',
    );
    expect(media.getVideoContentType()).toBe('hls');
  });

  it('should get content ID', () => {
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording(),
      'id',
      'my-content-id',
      'title',
    );
    expect(media.getContentID()).toBe('my-content-id');
  });

  it('should get title', () => {
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording(),
      'id',
      'content_id',
      'My Recording',
    );
    expect(media.getTitle()).toBe('My Recording');
  });

  it('should get event count', () => {
    const media = new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      'camera',
      createFrigateRecording({ events: 5 }),
      'id',
      'content_id',
      'title',
    );
    expect(media.getEventCount()).toBe(5);
  });
});

describe('FrigateReviewViewMedia', () => {
  it('should get ID', () => {
    const review = createFrigateReview({ id: 'rev-1' });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getID()).toBe('rev-1');
  });

  it('should get start time', () => {
    const review = createFrigateReview({
      start_time: 1683395000,
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getStartTime()).toEqual(new Date(1683395000 * 1000));
  });

  it('should get end time', () => {
    const review = createFrigateReview({
      end_time: 1683397124,
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getEndTime()).toEqual(new Date(1683397124 * 1000));
  });

  it('should get null end time when null', () => {
    const review = createFrigateReview({ end_time: null });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getEndTime()).toBeNull();
  });

  it('should report in progress when no end time', () => {
    const review = createFrigateReview({ end_time: null });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.inProgress()).toBe(true);
  });

  it('should report not in progress when end time set', () => {
    const review = createFrigateReview({
      end_time: 1683397124,
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.inProgress()).toBe(false);
  });

  it('should get video content type as HLS', () => {
    const media = new FrigateReviewViewMedia(
      'camera',
      createFrigateReview(),
      'content_id',
      'thumb',
    );
    expect(media.getVideoContentType()).toBe('hls');
  });

  it('should get content ID', () => {
    const media = new FrigateReviewViewMedia(
      'camera',
      createFrigateReview(),
      'my-content',
      'thumb',
    );
    expect(media.getContentID()).toBe('my-content');
  });

  it('should get title from metadata', () => {
    const review = createFrigateReview({
      data: {
        objects: ['person'],
        zones: [],
        metadata: { title: 'Metadata Title' },
      },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getTitle()).toBe('Metadata Title');
  });

  it('should get title from review util when no metadata', () => {
    const review = createFrigateReview({
      data: { objects: ['person'], zones: [] },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getTitle()).toBe('Person');
  });

  it('should get description from scene', () => {
    const review = createFrigateReview({
      data: {
        objects: [],
        zones: [],
        metadata: {
          scene: 'A person walking',
          title: 'Title',
        },
      },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getDescription()).toBe('A person walking');
  });

  it('should get description from shortSummary', () => {
    const review = createFrigateReview({
      data: {
        objects: [],
        zones: [],
        metadata: {
          shortSummary: 'Short summary text',
          title: 'Title',
        },
      },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getDescription()).toBe('Short summary text');
  });

  it('should get null description when no metadata', () => {
    const review = createFrigateReview({
      data: { objects: [], zones: [] },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getDescription()).toBeNull();
  });

  it('should get thumbnail', () => {
    const media = new FrigateReviewViewMedia(
      'camera',
      createFrigateReview(),
      'content_id',
      'my-thumb',
    );
    expect(media.getThumbnail()).toBe('my-thumb');
  });

  it('should get null thumbnail', () => {
    const media = new FrigateReviewViewMedia(
      'camera',
      createFrigateReview(),
      'content_id',
      null,
    );
    expect(media.getThumbnail()).toBeNull();
  });

  it('should get severity for alert', () => {
    const review = createFrigateReview({
      severity: 'alert',
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getSeverity()).toBe('high');
  });

  it('should get severity for detection', () => {
    const review = createFrigateReview({
      severity: 'detection',
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getSeverity()).toBe('medium');
  });

  it('should get reviewed status', () => {
    const review = createFrigateReview({
      has_been_reviewed: true,
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.isReviewed()).toBe(true);
  });

  it('should set reviewed status', () => {
    const media = new FrigateReviewViewMedia(
      'camera',
      createFrigateReview({ has_been_reviewed: false }),
      'content_id',
      'thumb',
    );
    media.setReviewed(true);
    expect(media.isReviewed()).toBe(true);
  });

  it('should get what from objects', () => {
    const review = createFrigateReview({
      data: { objects: ['person', 'car'], zones: [] },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getWhat()).toEqual(['person', 'car']);
  });

  it('should get null what when no objects', () => {
    const review = createFrigateReview({
      data: { zones: [] },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getWhat()).toBeNull();
  });

  it('should get where from zones', () => {
    const review = createFrigateReview({
      data: { objects: [], zones: ['front_yard'] },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getWhere()).toEqual(['front_yard']);
  });

  it('should get null where when no zones', () => {
    const review = createFrigateReview({
      data: { objects: [], zones: [] },
    });
    const media = new FrigateReviewViewMedia('camera', review, 'content_id', 'thumb');
    expect(media.getWhere()).toBeNull();
  });
});

describe('FrigateViewMediaFactory', () => {
  describe('createEventViewMedia', () => {
    it('should create clip view media', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const event = createFrigateEvent({
        has_clip: true,
      });
      const media = FrigateViewMediaFactory.createEventViewMedia(
        ViewMediaType.Clip,
        'camera',
        config,
        event,
      );
      expect(media).toBeInstanceOf(FrigateEventViewMedia);
      expect(media?.getContentID()).toContain('clips');
    });

    it('should create snapshot view media', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const event = createFrigateEvent({
        has_snapshot: true,
      });
      const media = FrigateViewMediaFactory.createEventViewMedia(
        ViewMediaType.Snapshot,
        'camera',
        config,
        event,
      );
      expect(media).toBeInstanceOf(FrigateEventViewMedia);
      expect(media?.getContentID()).toContain('snapshots');
    });

    it('should return null when clip missing', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const event = createFrigateEvent({
        has_clip: false,
      });
      const media = FrigateViewMediaFactory.createEventViewMedia(
        ViewMediaType.Clip,
        'camera',
        config,
        event,
      );
      expect(media).toBeNull();
    });

    it('should return null when snapshot missing', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const event = createFrigateEvent({
        has_snapshot: false,
      });
      const media = FrigateViewMediaFactory.createEventViewMedia(
        ViewMediaType.Snapshot,
        'camera',
        config,
        event,
      );
      expect(media).toBeNull();
    });

    it('should return null when no camera_name', () => {
      const config = createCameraConfig();
      const media = FrigateViewMediaFactory.createEventViewMedia(
        ViewMediaType.Clip,
        'camera',
        config,
        createFrigateEvent(),
      );
      expect(media).toBeNull();
    });

    it('should pass sub-labels through', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const media = FrigateViewMediaFactory.createEventViewMedia(
        ViewMediaType.Clip,
        'camera',
        config,
        createFrigateEvent(),
        ['Amazon'],
      );
      expect(media?.getTags()).toEqual(['Amazon']);
    });
  });

  describe('createRecordingViewMedia', () => {
    it('should create recording view media', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const media = FrigateViewMediaFactory.createRecordingViewMedia(
        'camera',
        createFrigateRecording(),
        config,
        'Front Camera',
      );
      expect(media).toBeInstanceOf(FrigateRecordingViewMedia);
    });

    it('should return null when no camera_name', () => {
      const config = createCameraConfig();
      const media = FrigateViewMediaFactory.createRecordingViewMedia(
        'camera',
        createFrigateRecording(),
        config,
        'Front Camera',
      );
      expect(media).toBeNull();
    });
  });

  describe('createReviewViewMedia', () => {
    it('should create review view media', () => {
      const config = createCameraConfig({
        frigate: {
          client_id: 'client',
          camera_name: 'front',
        },
      });
      const media = FrigateViewMediaFactory.createReviewViewMedia(
        'camera',
        createFrigateReview(),
        config,
      );
      expect(media).toBeInstanceOf(FrigateReviewViewMedia);
    });

    it('should return null when no camera_name', () => {
      const config = createCameraConfig();
      const media = FrigateViewMediaFactory.createReviewViewMedia(
        'camera',
        createFrigateReview(),
        config,
      );
      expect(media).toBeNull();
    });
  });
});
