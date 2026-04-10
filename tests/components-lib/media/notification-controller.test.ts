import { format } from 'date-fns';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../../src/camera-manager/manager';
import { ActionFactory } from '../../../src/card-controller/actions/factory';
import { CardController } from '../../../src/card-controller/controller';
import { ViewItemManager } from '../../../src/card-controller/view/item-manager';
import { ViewManagerEpoch } from '../../../src/card-controller/view/types';
import {
  MediaNotificationController,
  NotificationControlsContext,
} from '../../../src/components-lib/media/notification-controller';
import { NotificationControl } from '../../../src/config/schema/actions/types';
import { formatDateAndTime } from '../../../src/utils/basic';
import { downloadMedia, navigateToTimeline } from '../../../src/utils/media-actions';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import { createCardAPI, createFolder, TestViewMedia } from '../../test-utils';

vi.mock('../../../src/utils/media-actions', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  downloadMedia: vi.fn(),
  navigateToTimeline: vi.fn(),
}));

async function executeControlAction(
  control: NotificationControl,
  api: CardController,
): Promise<void> {
  const tapAction = control.actions?.tap_action;

  assert(tapAction && !Array.isArray(tapAction));
  const action = new ActionFactory().createAction({}, tapAction);

  await action?.execute(api);
}

describe('MediaNotificationController', () => {
  describe('should set heading', () => {
    it('should set heading on event with what, tags and score', () => {
      const item = new TestViewMedia({
        what: ['person', 'car'],
        tags: ['tag1', 'tag2'],
        score: 0.5,
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getHeading()?.text).toBe('Person, Car: Tag1, Tag2 50.00%');
    });

    it('should set heading on event with tags', () => {
      const item = new TestViewMedia({
        tags: ['tag1', 'tag2'],
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getHeading()?.text).toBe('Tag1, Tag2');
    });

    it('should set heading on event with what', () => {
      const item = new TestViewMedia({
        what: ['person', 'car'],
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getHeading()?.text).toBe('Person, Car');
    });

    it('should set null heading on event with no other information', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Snapshot,
        what: null,
        tags: null,
        score: null,
      });

      const controller = new MediaNotificationController();
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

      const controller = new MediaNotificationController();
      controller.calculate(cameraManager, item);
      expect(controller.getHeading()?.text).toBe('Camera Title');
    });

    it('should set heading on recording without camera metadata', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Recording,
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });

    it('should set no heading on folder', () => {
      const item = new ViewFolder(createFolder(), []);

      const controller = new MediaNotificationController();
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

        const controller = new MediaNotificationController();
        controller.calculate(null, item);
        expect(controller.getMetadata()).toContainEqual({
          text: 'Test Event',
          icon: 'mdi:rename',
          tooltip: 'Title',
        });
      });

      it('should not have icon with title when there are no other details', () => {
        const item = new TestViewMedia({
          title: 'Test Event',
        });

        const controller = new MediaNotificationController();
        controller.calculate(null, item);
        expect(controller.getMetadata()).toEqual([
          {
            text: 'Test Event',
          },
        ]);
      });

      it('should not have title with a start time', () => {
        const item = new TestViewMedia({
          title: 'Test Event',
          startTime: new Date('2025-05-22T21:12:00Z'),
        });

        const controller = new MediaNotificationController();
        controller.calculate(null, item);
        expect(controller.getMetadata()).not.toContainEqual(
          expect.objectContaining({
            text: 'Test Event',
          }),
        );
      });
    });

    it('should have start time in details', () => {
      const startTime = new Date('2025-05-18T17:03:00Z');
      const item = new TestViewMedia({
        startTime,
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      // Use formatDateAndTime to generate expected value (formats in local time with seconds)
      expect(controller.getMetadata()).toContainEqual({
        text: formatDateAndTime(startTime, true),
        tooltip: 'Start',
        icon: 'mdi:calendar-clock-outline',
      });
    });

    describe('should have duration in details', () => {
      it('should have duration in details', () => {
        const item = new TestViewMedia({
          startTime: new Date('2025-05-18T17:03:00Z'),
          endTime: new Date('2025-05-18T17:04:00Z'),
        });

        const controller = new MediaNotificationController();
        controller.calculate(null, item);
        expect(controller.getMetadata()).toContainEqual({
          text: '1m 0s',
          tooltip: 'Duration',
          icon: 'mdi:clock-outline',
        });
      });

      it('should have in-progress in details', () => {
        const item = new TestViewMedia({
          startTime: new Date('2025-05-18T17:03:00Z'),
          endTime: null,
          inProgress: true,
        });

        const controller = new MediaNotificationController();
        controller.calculate(null, item);
        expect(controller.getMetadata()).toContainEqual({
          text: 'In progress...',
          tooltip: 'Duration',
          icon: 'mdi:clock-outline',
        });
      });

      it('should have duration and in-progress in details', () => {
        const item = new TestViewMedia({
          startTime: new Date('2025-05-18T17:03:00Z'),
          endTime: new Date('2025-05-18T17:04:00Z'),
          inProgress: true,
        });

        const controller = new MediaNotificationController();
        controller.calculate(null, item);
        expect(controller.getMetadata()).toContainEqual({
          text: '1m 0s In progress...',
          tooltip: 'Duration',
          icon: 'mdi:clock-outline',
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

      const controller = new MediaNotificationController();
      controller.calculate(cameraManager, item);
      expect(controller.getMetadata()).toContainEqual({
        text: 'Camera Title',
        tooltip: 'Camera',
        icon: 'mdi:cctv',
      });
    });

    it('should have where in details', () => {
      const item = new TestViewMedia({
        cameraID: 'camera_1',
        where: ['where1', 'where2'],
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getMetadata()).toContainEqual({
        text: 'Where1, Where2',
        tooltip: 'Where',
        icon: 'mdi:map-marker-outline',
      });
    });

    it('should have tags in details', () => {
      const item = new TestViewMedia({
        cameraID: 'camera_1',
        tags: ['tag1', 'tag2'],
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getMetadata()).toContainEqual({
        text: 'Tag1, Tag2',
        tooltip: 'Tag',
        icon: 'mdi:tag',
      });
    });

    it('should have seek in details', () => {
      const item = new TestViewMedia();
      const seekTime = new Date('2025-05-20T07:14:57Z');

      const controller = new MediaNotificationController();
      controller.calculate(null, item, seekTime);

      // Use format() to generate expected value (formats in local time)
      expect(controller.getMetadata()).toContainEqual({
        text: format(seekTime, 'HH:mm:ss'),
        tooltip: 'Seek',
        icon: 'mdi:clock-fast',
      });
    });
    it('should set heading on review', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        title: 'Review Title',
        severity: 'high',
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      const heading = controller.getHeading();
      expect(heading?.text).toBe('Review Title');
      expect(heading?.severity).toBe('high');
      expect(heading?.icon).toBe('mdi:circle-medium');
      expect(heading?.tooltip).toBe('Severity: High');
    });

    it('should set heading on review without severity', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        title: 'Review Title',
        severity: null,
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      const heading = controller.getHeading();
      expect(heading?.text).toBe('Review Title');
      expect(heading?.severity).toBeUndefined();
    });

    it('should set null heading on review with no title', () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        title: null,
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);
      expect(controller.getHeading()).toBeNull();
    });

    it('should calculate with null item', () => {
      const controller = new MediaNotificationController();
      controller.calculate(null, undefined);
      expect(controller.getHeading()).toBeNull();
      expect(controller.getMetadata()).toEqual([]);
    });
  });

  describe('should get notification', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should get notification', () => {
      const item = new TestViewMedia({
        title: 'Test Title',
        what: ['person'],
        description: 'Test Description',
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification();
      expect(notification.heading?.text).toBe('Person');
      expect(notification.metadata).toContainEqual({
        text: 'Test Title',
      });
      expect(notification.body).toEqual({ text: 'Test Description' });
    });

    it('should get notification without media', () => {
      const item = new ViewFolder(createFolder(), []);

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification();
      expect(notification.body).toBeUndefined();
    });

    it('should get notification with null description', () => {
      const item = new TestViewMedia({
        description: null,
      });

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification();
      expect(notification.body).toBeUndefined();
    });

    it('should get notification with controls', async () => {
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

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification(context);
      const controls = notification.controls;
      assert(controls);
      expect(controls).toHaveLength(4);

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 1. Review control
      expect(controls?.[0].tooltip).toBe('Mark as reviewed');
      expect(controls?.[0].dismiss).toBe(false);
      await executeControlAction(controls[0], cardAPI);
      expect(cardAPI.getNotificationManager().setNotification).toHaveBeenCalled();

      // 1b. Review control (failure)
      vi.mocked(cardAPI.getNotificationManager().setNotification).mockClear();
      viewItemManager.reviewMedia.mockRejectedValue(new Error('fail'));
      await executeControlAction(controls[0], cardAPI);
      expect(cardAPI.getNotificationManager().setNotification).not.toHaveBeenCalled();

      // 2. Favorite control
      expect(controls?.[1].tooltip).toBe('Retain media indefinitely');
      expect(controls?.[1].dismiss).toBe(false);
      await executeControlAction(controls[1], cardAPI);
      expect(cardAPI.getNotificationManager().setNotification).toHaveBeenCalled();

      // 2b. Favorite control (failure)
      vi.mocked(cardAPI.getNotificationManager().setNotification).mockClear();
      viewItemManager.favorite.mockRejectedValue(new Error('fail'));
      await executeControlAction(controls[1], cardAPI);
      expect(cardAPI.getNotificationManager().setNotification).not.toHaveBeenCalled();

      // 3. Download control
      expect(controls?.[2].tooltip).toBe('Download media');
      expect(controls?.[2].dismiss).toBe(true);
      vi.mocked(downloadMedia).mockResolvedValue(true);
      await executeControlAction(controls[2], cardAPI);
      expect(downloadMedia).toHaveBeenCalledWith(item, viewItemManager);

      // 4. Timeline control
      expect(controls?.[3].tooltip).toBe('See media in timeline');
      expect(controls?.[3].dismiss).toBe(true);
      await executeControlAction(controls[3], cardAPI);
      expect(navigateToTimeline).toHaveBeenCalledWith(item, viewManagerEpoch);
    });

    it('should get notification with controls for already reviewed/favorited items', () => {
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

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification(context);
      const controls = notification.controls;
      expect(controls).toHaveLength(2);

      expect(controls?.[0].tooltip).toBe('Mark as unreviewed');
      expect(controls?.[0].icon).toBe('mdi:check-circle');

      expect(controls?.[1].severity).toBe('medium');
      expect(controls?.[1].icon).toBe('mdi:star');
    });

    it('should get notification with controls when item has no ID', () => {
      const item = new TestViewMedia({
        id: null,
      });
      const context = {
        capabilities: {
          canFavorite: false,
          canDownload: true,
        },
      };

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification(context);
      expect(notification.controls).toHaveLength(0);
    });

    it('should get notification with controls when context has no capabilities', () => {
      const item = new TestViewMedia({
        id: 'id',
      });
      const context = {};

      const controller = new MediaNotificationController();
      controller.calculate(null, item);

      const notification = controller.getNotification(context);
      expect(notification.controls).toHaveLength(0);
    });

    it('should get empty controls when item is null', () => {
      const ctrl = new MediaNotificationController();
      // Directly call protected method via casting to test the null item branch.
      // Use cast to unknown first to avoid any-related lint errors.
      const controls = (
        ctrl as unknown as {
          _getControls: (context: NotificationControlsContext) => NotificationControl[];
        }
      )._getControls({});
      expect(controls).toEqual([]);
    });
  });
});
