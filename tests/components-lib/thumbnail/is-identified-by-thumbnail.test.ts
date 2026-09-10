import { describe, expect, it } from 'vitest';

import { isIdentifiedByThumbnail } from '../../../src/components-lib/thumbnail/is-identified-by-thumbnail';
import { ViewFolder } from '../../../src/view/item';
import { createFolder } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

describe('isIdentifiedByThumbnail', () => {
  it('should identify media that has a thumbnail', () => {
    expect(
      isIdentifiedByThumbnail(new TestViewMedia({ thumbnail: 'thumbnail.jpg' })),
    ).toBe(true);
  });

  it('should not identify media that has no thumbnail', () => {
    expect(isIdentifiedByThumbnail(new TestViewMedia({ thumbnail: null }))).toBe(false);
  });

  it('should not identify a folder that has a thumbnail', () => {
    expect(
      isIdentifiedByThumbnail(
        new ViewFolder(createFolder(), [], { thumbnail: 'thumbnail.jpg' }),
      ),
    ).toBe(false);
  });

  it('should not identify a missing item', () => {
    expect(isIdentifiedByThumbnail()).toBe(false);
  });
});
