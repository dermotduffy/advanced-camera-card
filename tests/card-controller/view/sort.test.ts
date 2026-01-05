import { describe, expect, it } from 'vitest';
import { sortItems } from '../../../src/card-controller/view/sort.js';
import { createFolder, TestViewMedia } from '../../test-utils.js';
import { ViewFolder } from '../../../src/view/item.js';

describe('sortMedia', () => {
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
  const folder_1 = new ViewFolder(createFolder(), [], { id: 'folder_1' });
  const folder_2 = new ViewFolder(createFolder(), [], { id: 'folder_2' });

  it('should sort sorted media', () => {
    const media = [media_1, media_2];
    expect(sortItems(media)).toEqual(media);
  });
  it('should sort unsorted media', () => {
    expect(sortItems([media_2, media_1])).toEqual([media_1, media_2]);
  });
  it('should remove duplicate id', () => {
    expect(sortItems([media_1, media_2, media_3_dup_id])).toEqual([media_1, media_2]);
  });
  it('should sort by id when time not available', () => {
    const folder = createFolder();
    expect(
      sortItems([
        new TestViewMedia({ id: 'snake' }),
        new TestViewMedia({ id: 'zebra' }),
        new TestViewMedia({ id: 'aardvark' }),
        new ViewFolder(folder, [], { id: 'folder' }),
      ]),
    ).toEqual([
      new ViewFolder(folder, [], { id: 'folder' }),
      new TestViewMedia({ id: 'aardvark' }),
      new TestViewMedia({ id: 'snake' }),
      new TestViewMedia({ id: 'zebra' }),
    ]);
  });
  it('should remove de-duplicate by object if no id', () => {
    expect(sortItems([media_1, media_2, media_4_no_id, media_4_no_id])).toEqual([
      media_1,
      media_2,
      media_4_no_id,
    ]);
  });
  it('should sort folders at the start', () => {
    expect(sortItems([media_1, media_2, folder_1, folder_2])).toEqual([
      folder_1,
      folder_2,
      media_1,
      media_2,
    ]);
  });
});
