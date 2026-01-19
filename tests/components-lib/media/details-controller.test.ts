import { format } from 'date-fns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../../src/camera-manager/manager';
import { ViewItemManager } from '../../../src/card-controller/view/item-manager';
import { ViewManagerEpoch } from '../../../src/card-controller/view/types';
import {
  MediaDetailsController,
  OverlayControlsContext,
} from '../../../src/components-lib/media/details-controller';
import { OverlayMessageControl } from '../../../src/types';
import { formatDateAndTime } from '../../../src/utils/basic';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import { createCardAPI, createFolder, TestViewMedia } from '../../test-utils';

describe('MediaDetailsController', () => {
  describe('should set heading', () => {
    it('should set heading on event with what, tags and score', () => {
      const item = new TestViewMedia({
        what: ['person', 'car'],
        tags: ['tag1', 'tag2'],
        score: 0.5,
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()?.title).toBe('Person, Car: Tag1, Tag2 50.00%');
    });

    it('should set heading on event with tags', () => {
      const item = new TestViewMedia({
        tags: ['tag1', 'tag2'],
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()?.title).toBe('Tag1, Tag2');
    });

    it('should set heading on event with what', () => {
      const item = new TestViewMedia({
        what: ['person', 'car'],
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()?.title).toBe('Person, Car');
    });

    it('should set null heading on event with no other information', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Snapshot,
        what: null,
        tags: null,
        score: null,
      });

      const controller = new MediaDetailsController();
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

      const controller = new MediaDetailsController();
      controller.calculate(cameraManager, item);
      expect(controller.getHeading()?.title).toBe('Camera Title');
    });

    it('should set heading on recording without camera metadata', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Recording,
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });

    it('should set no heading on folder', () => {
      const item = new ViewFolder(createFolder(), []);

      const controller = new MediaDetailsController();
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

        const controller = new MediaDetailsController();
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

        const controller = new MediaDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).toEqual([
          {
            title: 'Test Event',
          },
        ]);
      });

      it('should not have title with a start time', () => {
        const item = new TestViewMedia({
          title: 'Test Event',
          startTime: new Date('2025-05-22T21:12:00Z'),
        });

        const controller = new MediaDetailsController();
        controller.calculate(null, item);
        expect(controller.getDetails()).not.toContainEqual(
          expect.objectContaining({
            title: 'Test Event',
          }),
        );
      });
    });

    it('should have start time in details', () => {
      const startTime = new Date('2025-05-18T17:03:00Z');
      const item = new TestViewMedia({
        startTime,
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      // Use formatDateAndTime to generate expected value (formats in local time with seconds)
      expect(controller.getDetails()).toContainEqual({
        title: formatDateAndTime(startTime, true),
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

        const controller = new MediaDetailsController();
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

        const controller = new MediaDetailsController();
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

        const controller = new MediaDetailsController();
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

      const controller = new MediaDetailsController();
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

      const controller = new MediaDetailsController();
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

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      expect(controller.getDetails()).toContainEqual({
        title: 'Tag1, Tag2',
        hint: 'Tag',
        icon: { icon: 'mdi:tag' },
      });
    });

    it('should have seek in details', () => {
      const item = new TestViewMedia();
      const seekTime = new Date('2025-05-20T07:14:57Z');

      const controller = new MediaDetailsController();
      controller.calculate(null, item, seekTime);

      // Use format() to generate expected value (formats in local time)
      expect(controller.getDetails()).toContainEqual({
        title: format(seekTime, 'HH:mm:ss'),
        hint: 'Seek',
        icon: { icon: 'mdi:clock-fast' },
      });
    });
    it('should set heading on review', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        title: 'Review Title',
        severity: 'high',
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      const heading = controller.getHeading();
      expect(heading?.title).toBe('Review Title');
      expect(heading?.emphasis).toBe('high');
      expect(heading?.icon).toEqual({ icon: 'mdi:circle-medium' });
      expect(heading?.hint).toBe('Severity: High');
    });

    it('should set heading on review without severity', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        title: 'Review Title',
        severity: null,
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      const heading = controller.getHeading();
      expect(heading?.title).toBe('Review Title');
      expect(heading?.emphasis).toBeUndefined();
    });

    it('should set null heading on review with no title', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        title: null,
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });

    it('should calculate with null item', () => {
      const controller = new MediaDetailsController();
      controller.calculate(null, undefined);
      expect(controller.getHeading()).toBeNull();
      expect(controller.getDetails()).toEqual([]);
    });
  });

  describe('should get message', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should get message', () => {
      const item = new TestViewMedia({
        title: 'Test Title',
        what: ['person'],
        description: 'Test Description',
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage();
      expect(message.heading?.title).toBe('Person');
      expect(message.details).toContainEqual({
        title: 'Test Title',
      });
      expect(message.text).toBe('Test Description');
    });

    it('should get message without media', () => {
      const item = new ViewFolder(createFolder(), []);

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage();
      expect(message.text).toBeUndefined();
    });

    it('should get message with null description', () => {
      const item = new TestViewMedia({
        description: null,
      });

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage();
      expect(message.text).toBeUndefined();
    });

    it('should get message with controls', async () => {
      const item = new TestViewMedia({
        title: 'Test Title',
        mediaType: ViewMediaType.Review,
        id: 'review_id',
        startTime: new Date(),
      });
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      const cardAPI = createCardAPI();
      viewManagerEpoch.manager = cardAPI.getViewManager();
      const viewItemManager = mock<ViewItemManager>();

      const context = {
        capabilities: {
          canFavorite: true,
          canDownload: true,
        },
        viewItemManager: viewItemManager,
        viewManagerEpoch: viewManagerEpoch,
      };

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage(context);
      const controls = message.controls;
      expect(controls).toHaveLength(4);

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 1. Review control
      expect(controls?.[0].title).toBe('Mark as reviewed');
      const reviewResult = await controls?.[0].callback?.();
      expect(reviewResult).not.toBeNull();

      // 1b. Review control (failure)
      viewItemManager.reviewMedia.mockRejectedValue(new Error('fail'));

      const reviewFailureResult = await controls?.[0].callback?.();
      expect(reviewFailureResult).toBeNull();

      // 2. Favorite control
      expect(controls?.[1].title).toBe('Media will be indefinitely retained');
      const favoriteResult = await controls?.[1].callback?.();
      expect(favoriteResult).not.toBeNull();

      // 2b. Favorite control (failure)
      viewItemManager.favorite.mockRejectedValue(new Error('fail'));
      const favoriteFailureResult = await controls?.[1].callback?.();
      expect(favoriteFailureResult).toBeNull();

      // 3. Download control
      expect(controls?.[2].title).toBe('Download media');
      const downloadResult = await controls?.[2].callback?.();
      expect(downloadResult).toBeNull();

      // 4. Timeline control
      expect(controls?.[3].title).toBe('See media in timeline');
      const timelineResult = await controls?.[3].callback?.();
      expect(timelineResult).toBeNull();
    });

    it('should get message with controls for already reviewed/favorited items', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        reviewed: true,
        favorite: true,
      });
      const context = {
        capabilities: {
          canFavorite: true,
          canDownload: false,
        },
      };

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage(context);
      const controls = message.controls;
      expect(controls).toHaveLength(2);

      expect(controls?.[0].title).toBe('Mark as unreviewed');
      expect(controls?.[0].icon).toEqual({ icon: 'mdi:check-circle' });

      expect(controls?.[1].emphasis).toBe('medium');
      expect(controls?.[1].icon).toEqual({ icon: 'mdi:star' });
    });

    it('should get message with controls when item has no ID', () => {
      const item = new TestViewMedia({
        id: null,
      });
      const context = {
        capabilities: {
          canFavorite: false,
          canDownload: true,
        },
      };

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage(context);
      expect(message.controls).toHaveLength(0);
    });

    it('should get message with controls when context has no capabilities', () => {
      const item = new TestViewMedia({
        id: 'id',
      });
      const context = {};

      const controller = new MediaDetailsController();
      controller.calculate(null, item);

      const message = controller.getMessage(context);
      expect(message.controls).toHaveLength(0);
    });

    it('should get empty controls when item is null', () => {
      const controller = new MediaDetailsController();
      // Directly call protected method via casting to test the null item branch.
      // Use cast to unknown first to avoid any-related lint errors.
      const controls = (
        controller as unknown as {
          _getControls: (context: OverlayControlsContext) => OverlayMessageControl[];
        }
      )._getControls({});
      expect(controls).toEqual([]);
    });
  });
});
