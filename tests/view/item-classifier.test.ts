import { describe, expect, it } from 'vitest';
import { ViewFolder, ViewMediaType } from '../../src/view/item';
import { ViewItemClassifier } from '../../src/view/item-classifier';
import { createFolder, TestViewMedia } from '../test-utils';

describe('ViewItemClassifier', () => {
  it('isMedia', () => {
    expect(ViewItemClassifier.isMedia(new TestViewMedia())).toBe(true);
    expect(ViewItemClassifier.isMedia(new ViewFolder(createFolder(), []))).toBe(false);
  });

  it('isFolder', () => {
    expect(ViewItemClassifier.isFolder(new ViewFolder(createFolder(), []))).toBe(true);
    expect(ViewItemClassifier.isFolder(new TestViewMedia())).toBe(false);
  });

  describe('isEvent', () => {
    it.each([
      [ViewMediaType.Clip as const, true],
      [ViewMediaType.Snapshot as const, true],
      [ViewMediaType.Recording as const, false],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewItemClassifier.isEvent(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isRecording', () => {
    it.each([
      [ViewMediaType.Clip as const, false],
      [ViewMediaType.Snapshot as const, false],
      [ViewMediaType.Recording as const, true],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewItemClassifier.isRecording(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isClip', () => {
    it.each([
      [ViewMediaType.Clip as const, true],
      [ViewMediaType.Snapshot as const, false],
      [ViewMediaType.Recording as const, false],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewItemClassifier.isClip(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isSnapshot', () => {
    it.each([
      [ViewMediaType.Clip as const, false],
      [ViewMediaType.Snapshot as const, true],
      [ViewMediaType.Recording as const, false],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewItemClassifier.isSnapshot(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isVideo', () => {
    it.each([
      [ViewMediaType.Clip as const, true],
      [ViewMediaType.Snapshot as const, false],
      [ViewMediaType.Recording as const, true],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewItemClassifier.isVideo(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('supportsTimeline', () => {
    it('should return false when item is not a media item with a start time', () => {
      expect(ViewItemClassifier.supportsTimeline(null)).toBe(false);
      expect(ViewItemClassifier.supportsTimeline(undefined)).toBe(false);
      expect(
        ViewItemClassifier.supportsTimeline(new ViewFolder(createFolder(), [])),
      ).toBe(false);
      expect(
        ViewItemClassifier.supportsTimeline(
          new TestViewMedia({ mediaType: ViewMediaType.Clip, startTime: null }),
        ),
      ).toBe(false);
    });

    it('should return true when item is a media item with a start time', () => {
      expect(
        ViewItemClassifier.supportsTimeline(
          new TestViewMedia({ mediaType: ViewMediaType.Clip, startTime: new Date() }),
        ),
      ).toBe(true);
      expect(
        ViewItemClassifier.supportsTimeline(
          new TestViewMedia({ mediaType: ViewMediaType.Review, startTime: new Date() }),
        ),
      ).toBe(true);
      expect(
        ViewItemClassifier.supportsTimeline(
          new TestViewMedia({
            mediaType: ViewMediaType.Recording,
            startTime: new Date(),
          }),
        ),
      ).toBe(true);
    });
  });
});
