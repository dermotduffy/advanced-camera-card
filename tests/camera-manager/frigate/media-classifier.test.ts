import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
  FrigateReviewViewMedia,
} from '../../../src/camera-manager/frigate/media';
import { FrigateViewMediaClassifier } from '../../../src/camera-manager/frigate/media-classifier';
import { ViewMedia, ViewMediaType } from '../../../src/view/item';
import {
  createFrigateEvent,
  createFrigateRecording,
  createFrigateReview,
} from '../../test-utils';

describe('FrigateViewMediaClassifier', () => {
  describe('isFrigateEvent', () => {
    it('should return true for event media', () => {
      const media = new FrigateEventViewMedia(
        ViewMediaType.Clip,
        'camera',
        createFrigateEvent(),
        'content_id',
        'thumbnail',
      );
      expect(FrigateViewMediaClassifier.isFrigateEvent(media)).toBe(true);
    });

    it('should return false for non-event media', () => {
      const media = mock<ViewMedia>();
      expect(FrigateViewMediaClassifier.isFrigateEvent(media)).toBe(false);
    });
  });

  describe('isFrigateRecording', () => {
    it('should return true for recording media', () => {
      const media = new FrigateRecordingViewMedia(
        ViewMediaType.Recording,
        'camera',
        createFrigateRecording(),
        'id',
        'content_id',
        'title',
      );
      expect(FrigateViewMediaClassifier.isFrigateRecording(media)).toBe(true);
    });

    it('should return false for non-recording media', () => {
      const media = mock<ViewMedia>();
      expect(FrigateViewMediaClassifier.isFrigateRecording(media)).toBe(false);
    });
  });

  describe('isFrigateReview', () => {
    it('should return true for review media', () => {
      const media = new FrigateReviewViewMedia(
        'camera',
        createFrigateReview(),
        'content_id',
        'thumbnail',
      );
      expect(FrigateViewMediaClassifier.isFrigateReview(media)).toBe(true);
    });

    it('should return false for non-review media', () => {
      const media = mock<ViewMedia>();
      expect(FrigateViewMediaClassifier.isFrigateReview(media)).toBe(false);
    });
  });

  describe('isFrigateMedia', () => {
    it('should return true for event media', () => {
      const media = new FrigateEventViewMedia(
        ViewMediaType.Clip,
        'camera',
        createFrigateEvent(),
        'content_id',
        'thumbnail',
      );
      expect(FrigateViewMediaClassifier.isFrigateMedia(media)).toBe(true);
    });

    it('should return true for review media', () => {
      const media = new FrigateReviewViewMedia(
        'camera',
        createFrigateReview(),
        'content_id',
        'thumbnail',
      );
      expect(FrigateViewMediaClassifier.isFrigateMedia(media)).toBe(true);
    });

    it('should return true for recording media', () => {
      const media = new FrigateRecordingViewMedia(
        ViewMediaType.Recording,
        'camera',
        createFrigateRecording(),
        'id',
        'content_id',
        'title',
      );
      expect(FrigateViewMediaClassifier.isFrigateMedia(media)).toBe(true);
    });

    it('should return false for non-frigate media', () => {
      const media = mock<ViewMedia>();
      expect(FrigateViewMediaClassifier.isFrigateMedia(media)).toBe(false);
    });
  });
});
