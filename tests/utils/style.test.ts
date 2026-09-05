import { describe, expect, it } from 'vitest';

import { getStyleColor } from '../../src/utils/style';

describe('getStyleColor', () => {
  it('should return the color a style sets', () => {
    expect(getStyleColor({ color: 'green' })).toBe('green');
  });

  it('should return null without a style', () => {
    expect(getStyleColor()).toBeNull();
  });

  it('should return null when the style sets no color', () => {
    expect(getStyleColor({ background: 'green' })).toBeNull();
  });

  it('should return null when the color is not a CSS color', () => {
    expect(getStyleColor({ color: 42 })).toBeNull();
  });
});
