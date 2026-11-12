import { describe, expect, it } from 'vitest';

import { getStyleColor, getStyleWithStateIconColor } from '../../src/utils/style';

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

describe('getStyleWithStateIconColor', () => {
  it('should default the icon color to the color a style sets', () => {
    expect(getStyleWithStateIconColor({ color: 'green' })).toEqual({
      '--state-icon-color': 'green',
      color: 'green',
    });
  });

  it('should keep an icon color the style sets itself', () => {
    expect(
      getStyleWithStateIconColor({ color: 'green', '--state-icon-color': 'blue' }),
    ).toEqual({
      '--state-icon-color': 'blue',
      color: 'green',
    });
  });

  it('should return an empty style without a style', () => {
    expect(getStyleWithStateIconColor()).toEqual({});
  });

  it('should not set an icon color when the style sets no color', () => {
    expect(getStyleWithStateIconColor({ background: 'green' })).toEqual({
      background: 'green',
    });
  });
});
