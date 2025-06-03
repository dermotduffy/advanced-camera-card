import { describe, expect, it } from 'vitest';
import {
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../../../src/ha/browse-media/types';
import { createBrowseMedia, createRichBrowseMedia } from '../../test-utils';
import { sortMostRecentFirst } from '../../../src/ha/browse-media/sort';

const createMetadata = (
  metadata: Partial<BrowseMediaMetadata>,
): BrowseMediaMetadata => ({
  cameraID: 'camera.office',
  startDate: new Date('2025-05-10T20:22:00Z'),
  endDate: new Date('2025-05-10T20:22:10Z'),
  ...metadata,
});

describe('sortMostRecentFirst', () => {
  it('should return an empty array when given an empty array', () => {
    const media: RichBrowseMedia<BrowseMediaMetadata>[] = [];
    expect(sortMostRecentFirst(media)).toEqual([]);
  });

  it('should sort media by startDate in descending order', () => {
    const media: RichBrowseMedia<BrowseMediaMetadata>[] = [
      createRichBrowseMedia({
        title: 'Media 1',
        _metadata: createMetadata({ startDate: new Date('2025-05-10T20:29:00.000Z') }),
      }),
      createRichBrowseMedia({
        title: 'Media 2',
        _metadata: createMetadata({ startDate: new Date('2025-05-12T20:29:00.000Z') }),
      }),
      createRichBrowseMedia({
        title: 'Media 3',
        _metadata: createMetadata({ startDate: new Date('2025-05-11T20:29:00.000Z') }),
      }),
    ];
    const expected: RichBrowseMedia<BrowseMediaMetadata>[] = [
      createRichBrowseMedia({
        title: 'Media 2',
        _metadata: createMetadata({ startDate: new Date('2025-05-12T20:29:00.000Z') }),
      }),
      createRichBrowseMedia({
        title: 'Media 3',
        _metadata: createMetadata({ startDate: new Date('2025-05-11T20:29:00.000Z') }),
      }),
      createRichBrowseMedia({
        title: 'Media 1',
        _metadata: createMetadata({ startDate: new Date('2025-05-10T20:29:00.000Z') }),
      }),
    ];
    expect(sortMostRecentFirst(media)).toEqual(expected);
  });

  it('should handle items with undefined startDate by placing them at the end', () => {
    const media: RichBrowseMedia<BrowseMediaMetadata>[] = [
      createRichBrowseMedia({
        title: 'Media 1',
        _metadata: createMetadata({ startDate: new Date('2025-05-10T20:29:00.000Z') }),
      }),
      createBrowseMedia({
        title: 'Media 2',
      }),
      createRichBrowseMedia({
        title: 'Media 3',
        _metadata: createMetadata({ startDate: new Date('2025-05-12T20:29:00.000Z') }),
      }),
      createBrowseMedia({
        title: 'Media 4',
      }),
    ];
    const expected: RichBrowseMedia<BrowseMediaMetadata>[] = [
      createBrowseMedia({
        title: 'Media 2',
      }),
      createBrowseMedia({
        title: 'Media 4',
      }),
      createRichBrowseMedia({
        title: 'Media 3',
        _metadata: createMetadata({ startDate: new Date('2025-05-12T20:29:00.000Z') }),
      }),
      createRichBrowseMedia({
        title: 'Media 1',
        _metadata: createMetadata({ startDate: new Date('2025-05-10T20:29:00.000Z') }),
      }),
    ];

    expect(sortMostRecentFirst(media)).toEqual(expected);
  });
});
