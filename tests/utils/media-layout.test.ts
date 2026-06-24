import { describe, expect, it } from 'vitest';

import { updateElementStyleFromMediaLayoutConfig } from '../../src/utils/media-layout.js';

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
