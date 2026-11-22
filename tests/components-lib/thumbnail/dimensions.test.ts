import { describe, expect, it } from 'vitest';

import {
  getThumbnailDimensions,
  getThumbnailTierSize,
  setThumbnailDimensionsStyle,
} from '../../../src/components-lib/thumbnail/dimensions';

describe('getThumbnailDimensions', () => {
  it.each([
    ['square', [1, 1] as [number, number], { width: 160, height: 160 }],
    ['wide', [16, 9] as [number, number], { width: 160, height: 90 }],
    ['tall', [9, 16] as [number, number], { width: 90, height: 160 }],
  ])(
    'should draw the longer side of a %s thumbnail at the size',
    (_name, aspectRatio, dimensions) => {
      expect(getThumbnailDimensions({ aspect_ratio: aspectRatio, size: 160 })).toEqual(
        dimensions,
      );
    },
  );

  it('should draw a square thumbnail for an invalid aspect ratio', () => {
    expect(getThumbnailDimensions({ aspect_ratio: [0, 9], size: 100 })).toEqual({
      width: 100,
      height: 100,
    });
  });
});

describe('getThumbnailTierSize', () => {
  it.each([
    ['square', [1, 1] as [number, number], 160],
    ['wide', [16, 9] as [number, number], 90],
    ['tall', [9, 16] as [number, number], 90],
  ])('should use the shorter side of a %s thumbnail', (_name, aspectRatio, tierSize) => {
    expect(getThumbnailTierSize({ aspect_ratio: aspectRatio, size: 160 })).toBe(
      tierSize,
    );
  });
});

// @vitest-environment jsdom
describe('setThumbnailDimensionsStyle', () => {
  it('should set the thumbnail dimensions', () => {
    const element = document.createElement('div');

    setThumbnailDimensionsStyle(element, { aspect_ratio: [16, 9], size: 160 });

    expect(element.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
      '160px',
    );
    expect(
      element.style.getPropertyValue('--advanced-camera-card-thumbnail-width'),
    ).toBe('160px');
    expect(
      element.style.getPropertyValue('--advanced-camera-card-thumbnail-height'),
    ).toBe('90px');
    expect(
      element.style.getPropertyValue('--advanced-camera-card-thumbnail-aspect-ratio'),
    ).toBe('160 / 90');
  });

  it('should remove the thumbnail dimensions without config', () => {
    const element = document.createElement('div');
    setThumbnailDimensionsStyle(element, { aspect_ratio: [16, 9], size: 160 });

    setThumbnailDimensionsStyle(element, null);

    expect(element.getAttribute('style')).toBeFalsy();
  });
});
