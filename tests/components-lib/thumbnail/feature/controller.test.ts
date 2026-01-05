import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../../../src/camera-manager/manager';
import { ThumbnailFeatureController } from '../../../../src/components-lib/thumbnail/feature/controller';
import { ViewFolder } from '../../../../src/view/item';
import { createFolder, TestViewMedia } from '../../../test-utils';

describe('ThumbnailFeatureController', () => {
  const itemWithTime = new TestViewMedia({
    startTime: new Date('2025-05-18T17:03:00Z'),
    title: 'Test Event',
    cameraID: 'camera_1',
  });

  describe('should set title', () => {
    it('should set title with start time ', () => {
      const controller = new ThumbnailFeatureController();

      controller.calculate(null, itemWithTime, false);

      // Use format() to generate expected time in local timezone
      const expectedTime = format(itemWithTime.getStartTime()!, 'HH:mm');
      expect(controller.getTitle()).toBe(expectedTime);
    });

    it('should not set title when details are shown ', () => {
      const controller = new ThumbnailFeatureController();

      controller.calculate(null, itemWithTime, true);

      expect(controller.getTitle()).toBeNull();
    });

    it('should not set title on media with a thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
        title: 'Test Event',
        cameraID: 'camera_1',
        thumbnail: 'thumbnail',
      });

      controller.calculate(null, itemWithThumbnail, true);

      expect(controller.getTitle()).toBeNull();
    });
  });

  describe('should set subtitles', () => {
    it('should set subtitle with start date ', () => {
      const controller = new ThumbnailFeatureController();

      controller.calculate(null, itemWithTime, false);

      // Use format() to generate expected date string (formats in local time)
      const expectedDate = format(itemWithTime.getStartTime()!, 'MMM do');
      expect(controller.getSubtitles()).toContain(expectedDate);
    });

    it('should set subtitle with source from item title ', () => {
      const controller = new ThumbnailFeatureController();

      controller.calculate(null, itemWithTime, false);

      expect(controller.getSubtitles()).toContain('Test Event');
    });

    it('should set subtitle with source from camera title ', () => {
      const controller = new ThumbnailFeatureController();

      const cameraManager = mock<CameraManager>();
      cameraManager.getCameraMetadata.mockReturnValue({
        title: 'Camera 1',
        icon: { icon: 'mdi:camera' },
      });

      const itemWithoutTitle = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
        title: null,
        cameraID: 'camera_1',
      });

      controller.calculate(cameraManager, itemWithoutTitle, false);

      expect(controller.getSubtitles()).toContain('Camera 1');
    });

    it('should set subtitle falling back to item title when cameraID not found', () => {
      const controller = new ThumbnailFeatureController();

      const item = new TestViewMedia({
        title: 'Title',
        cameraID: null,
      });

      controller.calculate(null, item, false);

      expect(controller.getSubtitles()).toContain('Title');
    });

    it('should not set subtitle on media with a thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
        title: 'Test Event',
        cameraID: 'camera_1',
        thumbnail: 'thumbnail',
      });

      controller.calculate(null, itemWithThumbnail, false);

      expect(controller.getSubtitles()).toEqual([]);
    });

    it('should not set subtitle on folder media', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new ViewFolder(createFolder(), [], {
        title: 'Test Folder',
      });

      controller.calculate(null, itemWithThumbnail, false);

      expect(controller.getSubtitles()).toContain('Test Folder');
    });
  });

  describe('should set icon', () => {
    it('should set icon without a thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: null,
        icon: 'mdi:cow',
      });

      controller.calculate(null, itemWithThumbnail, false);

      expect(controller.getIcon()).toBe('mdi:cow');
    });

    it('should not set icon when there is a thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: 'thumbnail',
        icon: 'mdi:cow',
      });

      controller.calculate(null, itemWithThumbnail, false);

      expect(controller.getIcon()).toBeNull();
    });
  });

  describe('should set thumbnail', () => {
    it('should set brand thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: 'https://brands.home-assistant.io//amcrest/icon.png',
      });

      controller.calculate(null, itemWithThumbnail, false);

      expect(controller.getThumbnail()).toBe(
        'https://brands.home-assistant.io/brands/_/amcrest/icon.png',
      );
      expect(controller.getThumbnailClass()).toBe('brand');
    });

    it('should set other thumbnail', () => {
      const controller = new ThumbnailFeatureController();
      const itemWithThumbnail = new TestViewMedia({
        thumbnail: 'https://card.camera/thumbnail.jpg',
      });

      controller.calculate(null, itemWithThumbnail, false);

      expect(controller.getThumbnail()).toBe('https://card.camera/thumbnail.jpg');
      expect(controller.getThumbnailClass()).toBeNull();
    });
  });
});
