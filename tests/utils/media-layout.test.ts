import { describe, expect, it } from 'vitest';

import type { CameraDimensionsConfig } from '../../src/config/schema/cameras.js';
import {
  isMediaContainedAndCentered,
  updateElementStyleFromMediaLayoutConfig,
} from '../../src/utils/media-layout.js';

// @vitest-environment jsdom
describe('updateElementStyleFromMediaLayoutConfig', () => {
  describe('fit', () => {
    it('set', () => {
      const video = document.createElement('video');

      updateElementStyleFromMediaLayoutConfig(video, {
        fit: 'cover',
      });

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-fit'),
      ).toBe('cover');
    });

    it('unset', () => {
      const video = document.createElement('video');
      video.style.setProperty('--advanced-camera-card-media-layout-fit', 'cover');

      updateElementStyleFromMediaLayoutConfig(video);

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-fit'),
      ).toBeFalsy();
    });
  });

  describe('position', () => {
    it('set', () => {
      const video = document.createElement('video');

      updateElementStyleFromMediaLayoutConfig(video, {
        position: {
          x: 10,
          y: 20,
        },
      });

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-position-x'),
      ).toBe('10%');
      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-position-y'),
      ).toBe('20%');
    });

    it('should set a position of zero', () => {
      const video = document.createElement('video');

      updateElementStyleFromMediaLayoutConfig(video, {
        position: {
          x: 0,
          y: 0,
        },
      });

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-position-x'),
      ).toBe('0%');
      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-position-y'),
      ).toBe('0%');
    });

    it('unset', () => {
      const video = document.createElement('video');
      video.style.setProperty('--advanced-camera-card-media-layout-position-x', '10%');
      video.style.setProperty('--advanced-camera-card-media-layout-position-y', '20%');

      updateElementStyleFromMediaLayoutConfig(video);

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-position-x'),
      ).toBeFalsy();
      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-position-y'),
      ).toBeFalsy();
    });
  });

  describe('view_box', () => {
    it('set', () => {
      const video = document.createElement('video');

      updateElementStyleFromMediaLayoutConfig(video, {
        view_box: {
          top: 1,
          bottom: 2,
          left: 3,
          right: 4,
        },
      });

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-view-box-top'),
      ).toBe('1%');
      expect(
        video.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-bottom',
        ),
      ).toBe('2%');
      expect(
        video.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-left',
        ),
      ).toBe('3%');
      expect(
        video.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-right',
        ),
      ).toBe('4%');
    });

    it('unset', () => {
      const video = document.createElement('video');
      video.style.setProperty('--advanced-camera-card-media-layout-view-box-top', '1%');
      video.style.setProperty(
        '--advanced-camera-card-media-layout-view-box-bottom',
        '2%',
      );
      video.style.setProperty('--advanced-camera-card-media-layout-view-box-left', '3%');
      video.style.setProperty(
        '--advanced-camera-card-media-layout-view-box-right',
        '4%',
      );

      updateElementStyleFromMediaLayoutConfig(video);

      expect(
        video.style.getPropertyValue('--advanced-camera-card-media-layout-view-box-top'),
      ).toBeFalsy();
      expect(
        video.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-bottom',
        ),
      ).toBeFalsy();
      expect(
        video.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-left',
        ),
      ).toBeFalsy();
      expect(
        video.style.getPropertyValue(
          '--advanced-camera-card-media-layout-view-box-right',
        ),
      ).toBeFalsy();
    });
  });
});

describe('isMediaContainedAndCentered', () => {
  it.each([
    ['no dimensions', null],
    ['empty dimensions', {}],
    ['an explicit contain fit', { layout: { fit: 'contain' } }],
    ['a centered position', { layout: { position: { x: 50, y: 50 } } }],
    [
      'an empty view box',
      { layout: { view_box: { top: 0, bottom: 0, left: 0, right: 0 } } },
    ],
  ] satisfies [string, CameraDimensionsConfig | null][])(
    'should be contained and centered with %s',
    (_name: string, dimensions: CameraDimensionsConfig | null) => {
      expect(isMediaContainedAndCentered(dimensions)).toBe(true);
    },
  );

  it.each([
    ['a fixed aspect ratio', { aspect_ratio: [4, 3] }],
    ['a rotation', { rotation: 90 }],
    ['a cover fit', { layout: { fit: 'cover' } }],
    ['a fill fit', { layout: { fit: 'fill' } }],
    ['an off-center x position', { layout: { position: { x: 0 } } }],
    ['an off-center y position', { layout: { position: { y: 100 } } }],
    ['a view box', { layout: { view_box: { top: 0, bottom: 10, left: 0, right: 0 } } }],
  ] satisfies [string, CameraDimensionsConfig][])(
    'should not be contained and centered with %s',
    (_name: string, dimensions: CameraDimensionsConfig) => {
      expect(isMediaContainedAndCentered(dimensions)).toBe(false);
    },
  );
});
