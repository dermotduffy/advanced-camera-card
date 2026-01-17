import { describe, expect, it } from 'vitest';
import {
  FrigateEventViewMedia,
  FrigateReviewViewMedia,
} from '../../../src/camera-manager/frigate/media';
import { ViewMediaType } from '../../../src/view/item';
import { createFrigateEvent, createFrigateReview } from '../../test-utils';

describe('FrigateReviewViewMedia', () => {
  it('should get description when scene is present', () => {
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
    const media = new FrigateReviewViewMedia(
      'camera',
      review,
      'content_id',
      'thumbnail',
    );
    expect(media.getDescription()).toBe('A person walking');
  });

  it('should get null description when scene is absent', () => {
    const review = createFrigateReview({
      data: {
        objects: [],
        zones: [],
        metadata: {
          title: 'Title',
          // scene is absent.
        },
      },
    });
    const media = new FrigateReviewViewMedia(
      'camera',
      review,
      'content_id',
      'thumbnail',
    );
    expect(media.getDescription()).toBeNull();
  });
});

describe('FrigateEventViewMedia', () => {
  it('should get description when description is present', () => {
    const event = createFrigateEvent({
      data: {
        description: 'A person walking',
      },
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

  it('should get null description when data is absent', () => {
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
});
