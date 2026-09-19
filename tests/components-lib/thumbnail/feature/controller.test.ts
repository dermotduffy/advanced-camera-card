import { describe, expect, it } from 'vitest';

import { ThumbnailFeatureController } from '../../../../src/components-lib/thumbnail/feature/controller';
import { ViewFolder } from '../../../../src/view/item';
import { createCameraManagerWithMetadata } from '../../../camera-manager/test-utils';
import { createFolder } from '../../../test-utils';
import { TestViewMedia } from '../../../view/test-utils';

describe('ThumbnailFeatureController', () => {
  describe('should set icon', () => {
    it('should set icon without a thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: null,
        icon: 'mdi:cow',
      });

      controller.calculate({ item: itemWithThumbnail });

      expect(controller.getIcon()).toBe('mdi:cow');
    });

    it('should not set icon when there is a thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: 'thumbnail',
        icon: 'mdi:cow',
      });

      controller.calculate({ item: itemWithThumbnail });

      expect(controller.getIcon()).toBeNull();
    });
  });

  describe('should set thumbnail', () => {
    it('should set placeholder thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: 'https://brands.home-assistant.io//amcrest/icon.png',
      });

      controller.calculate({ item: itemWithThumbnail });

      expect(controller.getThumbnail()).toBe(
        'https://brands.home-assistant.io/brands/_/amcrest/icon.png',
      );
      expect(controller.getThumbnailClass()).toBe('placeholder');
    });

    it('should set other thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: 'https://card.camera/thumbnail.jpg',
      });

      controller.calculate({ item: itemWithThumbnail });

      expect(controller.getThumbnail()).toBe('https://card.camera/thumbnail.jpg');
      expect(controller.getThumbnailClass()).toBeNull();
    });

    it('should set placeholder thumbnail for non-brand folder thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const folder = new ViewFolder(createFolder(), [], {
        title: 'Test Folder',
        thumbnail: 'https://card.camera/thumbnail.jpg',
      });

      controller.calculate({ item: folder });

      expect(controller.getThumbnail()).toBe('https://card.camera/thumbnail.jpg');
      expect(controller.getThumbnailClass()).toBe('placeholder');
    });

    it('should not set placeholder thumbnail for a configured folder thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const folder = new ViewFolder(createFolder(), [], {
        title: 'Test Folder',
        thumbnail: 'https://card.camera/thumbnail.jpg',
        isThumbnailConfigured: true,
      });

      controller.calculate({ item: folder });

      expect(controller.getThumbnail()).toBe('https://card.camera/thumbnail.jpg');
      expect(controller.getThumbnailClass()).toBeNull();
    });

    it('should fall back to camera metadata icon when there is no thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const cameraManager = createCameraManagerWithMetadata({
        title: 'Camera 1',
        icon: { icon: 'mdi:camera' },
        engineIcon: 'mdi:cctv',
      });

      const item = new TestViewMedia({
        thumbnail: null,
        icon: null,
        cameraID: 'camera_1',
      });

      controller.calculate({ cameraManager, item });

      expect(controller.getIcon()).toBe('mdi:cctv');
    });
  });
});
