import { describe, expect, it } from 'vitest';
import { getViewMediaFromBrowseMediaArray } from '../../../src/ha/browse-media/browse-media-to-view-media';
import {
  BrowseMediaMetadata,
  MEDIA_CLASS_IMAGE,
  MEDIA_CLASS_VIDEO,
  RichBrowseMedia,
} from '../../../src/ha/browse-media/types';
import { createBrowseMedia, createRichBrowseMedia } from '../../test-utils';

const createBrowseMediaChildren = (
  overrides: Partial<RichBrowseMedia<BrowseMediaMetadata>>[],
) => {
  return overrides.map((override) => createRichBrowseMedia(override));
};

describe('getViewMediaFromBrowseMediaArray', () => {
  it('should not ignore absent metadata', () => {
    const children = [createBrowseMedia()];
    const viewMedia = getViewMediaFromBrowseMediaArray(children, {
      cameraID: 'camera.office',
    });
    expect(viewMedia).toHaveLength(1);
    expect(viewMedia?.[0].getMediaType()).toBe('clip');
    expect(viewMedia?.[0].getID()).toBe('content_id');
  });

  it('should ignore unknown media class', () => {
    const children = createBrowseMediaChildren([{ media_class: 'UNKNOWN' }]);
    expect(
      getViewMediaFromBrowseMediaArray(children, { cameraID: 'camera.office' }),
    ).toEqual([]);
  });

  it('should generate clip view media', () => {
    const children = createBrowseMediaChildren([{ media_class: MEDIA_CLASS_VIDEO }]);
    const viewMedia = getViewMediaFromBrowseMediaArray(children, {
      cameraID: 'camera.office',
    });
    expect(viewMedia).toHaveLength(1);
    expect(viewMedia?.[0].getMediaType()).toBe('clip');
    expect(viewMedia?.[0].getID()).toBe('camera.office/2024-11-19 07:23:00');
  });

  it('should generate snapshot view media', () => {
    const children = createBrowseMediaChildren([{ media_class: MEDIA_CLASS_IMAGE }]);
    const viewMedia = getViewMediaFromBrowseMediaArray(children, {
      cameraID: 'camera.office',
    });
    expect(viewMedia).toHaveLength(1);
    expect(viewMedia?.[0].getMediaType()).toBe('snapshot');
    expect(viewMedia?.[0].getID()).toBe('camera.office/2024-11-19 07:23:00');
  });
});
