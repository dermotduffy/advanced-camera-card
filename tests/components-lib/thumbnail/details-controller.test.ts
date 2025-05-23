import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../../src/camera-manager/manager';
import { ThumbnailDetailsController } from '../../../src/components-lib/thumbnail/details-controller';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import { createFolder, TestViewMedia } from '../../test-utils';

describe('ThumbnailDetailsController', () => {
  describe('should set heading', () => {
    it('should set heading on event with what, tags and score', () => {
      const item = new TestViewMedia({
        what: ['person', 'car'],
        tags: ['tag1', 'tag2'],
        score: 0.5,
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBe('Person, Car: Tag1, Tag2 50.00%');
    });

    it('should set heading on event with tags', () => {
      const item = new TestViewMedia({
        tags: ['tag1', 'tag2'],
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBe('Tag1, Tag2');
    });

    it('should set heading on event with what', () => {
      const item = new TestViewMedia({
        what: ['person', 'car'],
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBe('Person, Car');
    });

    it('should set null heading on event with no other information', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Snapshot,
        what: null,
        tags: null,
        score: null,
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });

    it('should set heading on recording with camera metadata', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getCameraMetadata.mockReturnValue({
        title: 'Camera Title',
        icon: { icon: 'mdi:cow' },
      });

      const item = new TestViewMedia({
        mediaType: ViewMediaType.Recording,
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(cameraManager, item);
      expect(controller.getHeading()).toBe('Camera Title');
    });

    it('should set heading on recording without camera metadata', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Recording,
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });

    it('should set no heading on folder', () => {
      const item = new ViewFolder(createFolder());

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });
  });

  describe('should set details', () => {
    describe('should have title in details', () => {
      it('should have icon with title when there are other details', () => {
        const item = new TestViewMedia({
          title: 'Test Event',
          where: ['where1', 'where2'],
        });

        const controller = new ThumbnailDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).toContainEqual({
          title: 'Test Event',
          icon: { icon: 'mdi:rename' },
          hint: 'Title',
        });
      });

      it('should not have icon with title when there are no other details', () => {
        const item = new TestViewMedia({
          title: 'Test Event',
        });

        const controller = new ThumbnailDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).toEqual([
          {
            title: 'Test Event',
          },
        ]);
      });

      it('should not have title with a what and a start time', () => {
        const item = new TestViewMedia({
          title: 'Test Event',
          what: ['person', 'car'],
          startTime: new Date('2025-05-22T21:12:00Z'),
        });

        const controller = new ThumbnailDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).not.toContainEqual(
          expect.objectContaining({
            title: 'Test Event',
          }),
        );
      });
    });

    it('should have start time in details', () => {
      const item = new TestViewMedia({
        startTime: new Date('2025-05-18T17:03:00Z'),
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getDetails()).toContainEqual({
        title: '2025-05-18 17:03:00',
        hint: 'Start',
        icon: { icon: 'mdi:calendar-clock-outline' },
      });
    });

    describe('should have duration in details', () => {
      it('should have duration in details', () => {
        const item = new TestViewMedia({
          startTime: new Date('2025-05-18T17:03:00Z'),
          endTime: new Date('2025-05-18T17:04:00Z'),
        });

        const controller = new ThumbnailDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).toContainEqual({
          title: '1m 0s',
          hint: 'Duration',
          icon: { icon: 'mdi:clock-outline' },
        });
      });

      it('should have in-progress in details', () => {
        const item = new TestViewMedia({
          startTime: new Date('2025-05-18T17:03:00Z'),
          endTime: null,
          inProgress: true,
        });

        const controller = new ThumbnailDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).toContainEqual({
          title: 'In Progress',
          hint: 'Duration',
          icon: { icon: 'mdi:clock-outline' },
        });
      });

      it('should have duration and in-progress in details', () => {
        const item = new TestViewMedia({
          startTime: new Date('2025-05-18T17:03:00Z'),
          endTime: new Date('2025-05-18T17:04:00Z'),
          inProgress: true,
        });

        const controller = new ThumbnailDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).toContainEqual({
          title: '1m 0s In Progress',
          hint: 'Duration',
          icon: { icon: 'mdi:clock-outline' },
        });
      });
    });

    it('should have camera title in details', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getCameraMetadata.mockReturnValue({
        title: 'Camera Title',
        icon: { icon: 'mdi:cow' },
      });

      const item = new TestViewMedia({
        cameraID: 'camera_1',
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(cameraManager, item);
      expect(controller.getDetails()).toContainEqual({
        title: 'Camera Title',
        hint: 'Camera',
        icon: { icon: 'mdi:cctv' },
      });
    });

    it('should have where in details', () => {
      const item = new TestViewMedia({
        cameraID: 'camera_1',
        where: ['where1', 'where2'],
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getDetails()).toContainEqual({
        title: 'Where1, Where2',
        hint: 'Where',
        icon: { icon: 'mdi:map-marker-outline' },
      });
    });

    it('should have tags in details', () => {
      const item = new TestViewMedia({
        cameraID: 'camera_1',
        tags: ['tag1', 'tag2'],
      });

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item);
      expect(controller.getDetails()).toContainEqual({
        title: 'Tag1, Tag2',
        hint: 'Tag',
        icon: { icon: 'mdi:tag' },
      });
    });

    it('should have seek in details', () => {
      const item = new TestViewMedia();

      const controller = new ThumbnailDetailsController();
      controller.calculate(null, item, new Date('2025-05-20T07:14:57Z'));
      expect(controller.getDetails()).toContainEqual({
        title: '07:14:57',
        hint: 'Seek',
        icon: { icon: 'mdi:clock-fast' },
      });
    });
  });
});
