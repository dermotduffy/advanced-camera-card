import { describe, expect, it } from 'vitest';

import { getTemplateMediaData } from '../../../../src/card-controller/folders/ha/template-media-data';
import { createBrowseMedia } from '../../../test-utils';

describe('getTemplateMediaData', () => {
  it('should get the template data for media', () => {
    expect(
      getTemplateMediaData(
        createBrowseMedia({
          media_content_id: 'media-source://media_source/local/clip.mp4',
          title: 'clip.mp4',
          can_expand: false,
        }),
      ),
    ).toEqual({
      id: 'media-source://media_source/local/clip.mp4',
      title: 'clip.mp4',
      is_folder: false,
    });
  });

  it('should get the template data for a folder', () => {
    expect(
      getTemplateMediaData(
        createBrowseMedia({
          media_content_id: 'media-source://media_source/local/folder',
          title: 'folder',
          can_expand: true,
        }),
      ),
    ).toEqual({
      id: 'media-source://media_source/local/folder',
      title: 'folder',
      is_folder: true,
    });
  });
});
