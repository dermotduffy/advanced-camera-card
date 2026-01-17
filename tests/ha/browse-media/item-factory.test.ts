import { describe, expect, it } from 'vitest';
import {
  BrowseMediaEventViewMedia,
  BrowseMediaViewFolder,
} from '../../../src/ha/browse-media/item';
import { BrowseMediaViewItemFactory } from '../../../src/ha/browse-media/item-factory';
import {
  MEDIA_CLASS_IMAGE,
  MEDIA_CLASS_VIDEO,
} from '../../../src/ha/browse-media/types';
import { ViewMediaType } from '../../../src/view/item';
import { createBrowseMedia, createFolder } from '../../test-utils';

describe('BrowseMediaViewItemFactory', () => {
  it('returns null if can_expand is true without options.folder', () => {
    const browseMedia = createBrowseMedia({ can_expand: true });
    expect(BrowseMediaViewItemFactory.create(browseMedia)).toBeNull();
  });

  it('returns a folder if can_expand is true with options.folder', () => {
    const browseMedia = createBrowseMedia({ can_expand: true });
    const result = BrowseMediaViewItemFactory.create(browseMedia, {
      folder: createFolder(),
      path: [],
    });
    expect(result).toBeInstanceOf(BrowseMediaViewFolder);
  });

  it('returns BrowseMediaEventViewMedia for MEDIA_CLASS_VIDEO', () => {
    const browseMedia = createBrowseMedia({ media_class: MEDIA_CLASS_VIDEO });
    const result = BrowseMediaViewItemFactory.create(browseMedia);
    expect(result).toBeInstanceOf(BrowseMediaEventViewMedia);
    if (result instanceof BrowseMediaEventViewMedia) {
      expect(result?.getMediaType()).toBe(ViewMediaType.Clip);
    }
  });

  it('returns BrowseMediaEventViewMedia for MEDIA_CLASS_VIDEO', () => {
    const browseMedia = createBrowseMedia({ media_class: MEDIA_CLASS_IMAGE });
    const result = BrowseMediaViewItemFactory.create(browseMedia);
    expect(result).toBeInstanceOf(BrowseMediaEventViewMedia);
    if (result instanceof BrowseMediaEventViewMedia) {
      expect(result?.getMediaType()).toBe(ViewMediaType.Snapshot);
    }
  });

  it('returns null for unknown media_class', () => {
    const browseMedia = createBrowseMedia({ media_class: 'UNKNOWN' });
    expect(BrowseMediaViewItemFactory.create(browseMedia)).toBeNull();
  });
});
