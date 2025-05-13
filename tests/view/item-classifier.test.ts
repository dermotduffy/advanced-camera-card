import { describe, expect, it } from 'vitest';
import { ViewFolder, ViewMediaType } from '../../src/view/item';
import { ViewItemClassifier } from '../../src/view/item-classifier';
import { createFolder, TestViewMedia } from '../test-utils';

describe('ViewItemClassifier', () => {
  it('isMedia', () => {
    expect(ViewItemClassifier.isMedia(new TestViewMedia())).toBe(true);
    expect(ViewItemClassifier.isMedia(new ViewFolder(createFolder()))).toBe(false);
  });

  it('isFolder', () => {
    expect(ViewItemClassifier.isFolder(new ViewFolder(createFolder()))).toBe(true);
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
});
