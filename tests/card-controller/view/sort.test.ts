import { describe, expect, it } from 'vitest';

import { sortItems } from '../../../src/card-controller/view/sort.js';
import { ViewFolder } from '../../../src/view/item.js';
import { createFolder } from '../../test-utils.js';
import { TestViewMedia } from '../../view/test-utils';

describe('sortItems', () => {
  const media_1 = new TestViewMedia({
    id: 'id-1',
    startTime: new Date('2023-04-29T14:25'),
    cameraID: 'camera-1',
  });
  const media_2 = new TestViewMedia({
    id: 'id-2',
    startTime: new Date('2023-04-29T14:26'),
    cameraID: 'camera-1',
  });
  const media_3_dup_id = new TestViewMedia({
    id: 'id-2',
    startTime: new Date('2023-04-29T14:26'),
    cameraID: 'camera-1',
  });
  const media_4_no_id = new TestViewMedia({
    id: null,
    startTime: new Date('2023-04-29T14:27'),
    cameraID: 'camera-1',
  });

  it('should preserve the sort of media that is already in order', () => {
    const media = [media_1, media_2];
    expect(sortItems(media)).toEqual(media);
  });
  it('should put media in order of start time', () => {
    expect(sortItems([media_2, media_1])).toEqual([media_1, media_2]);
  });
  it('should remove items with a duplicate ID', () => {
    expect(sortItems([media_1, media_2, media_3_dup_id])).toEqual([media_1, media_2]);
  });
  it('should remove repeats of the same item when it has no ID', () => {
    expect(sortItems([media_1, media_2, media_4_no_id, media_4_no_id])).toEqual([
      media_1,
      media_2,
      media_4_no_id,
    ]);
  });
  it('should sort items without a start time first, as the oldest', () => {
    const undated = new TestViewMedia({ id: 'undated' });
    expect(sortItems([media_2, undated, media_1])).toEqual([undated, media_1, media_2]);
  });

  it('should sort folders and media together by start time', () => {
    const folder = new ViewFolder(createFolder(), [], {
      id: 'folder',
      startTime: new Date('2023-04-29T14:25:30'),
    });
    expect(sortItems([media_2, folder, media_1])).toEqual([media_1, folder, media_2]);
  });

  it('should sort folders before media that start at the same time', () => {
    const folder = new ViewFolder(createFolder(), [], {
      id: 'folder',
      startTime: media_1.getStartTime(),
    });
    expect(sortItems([media_1, folder])).toEqual([folder, media_1]);
  });

  it('should sort items that start at the same time by ID', () => {
    const later = new TestViewMedia({ id: 'b', startTime: media_1.getStartTime() });
    const earlier = new TestViewMedia({ id: 'a', startTime: media_1.getStartTime() });
    expect(sortItems([later, earlier])).toEqual([earlier, later]);
  });

  it('should sort consistently regardless of item order', () => {
    const undatedMedia = new TestViewMedia({ id: 'undated-media' });
    const undatedFolder = new ViewFolder(createFolder(), [], { id: 'undated-folder' });
    const datedFolder = new ViewFolder(createFolder(), [], {
      id: 'dated-folder',
      startTime: media_2.getStartTime(),
    });
    const expected = [undatedFolder, undatedMedia, media_1, datedFolder, media_2];

    for (const items of [
      [media_2, datedFolder, undatedMedia, media_1, undatedFolder],
      [undatedMedia, media_1, media_2, undatedFolder, datedFolder],
      [datedFolder, undatedFolder, media_2, undatedMedia, media_1],
    ]) {
      expect(sortItems(items)).toEqual(expected);
    }
  });
});
