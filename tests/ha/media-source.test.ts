import { describe, expect, it } from 'vitest';

import { isMediaSourceID } from '../../src/ha/media-source';

describe('isMediaSourceID', () => {
  it('should return true for a media source ID', () => {
    expect(isMediaSourceID('media-source://media_source/local/clip.mp4')).toBe(true);
  });

  it('should return false for a URL', () => {
    expect(isMediaSourceID('https://card.camera/image.jpg')).toBe(false);
  });

  it('should return false for a relative URL', () => {
    expect(isMediaSourceID('/media/local/clip.jpg')).toBe(false);
  });
});
