import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { ActionFactory } from '../../../src/card-controller/actions/factory';
import type { CardController } from '../../../src/card-controller/controller';
import type { ViewItemManager } from '../../../src/card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../../src/card-controller/view/types';
import { MediaNotificationController } from '../../../src/components-lib/notification/media-controller';
import type { NotificationControl } from '../../../src/config/schema/actions/types';
import { downloadMedia, navigateToTimeline } from '../../../src/utils/media-actions';
import { ViewFolder, ViewMediaType } from '../../../src/view/item';
import { createCardAPI, createFolder } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

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

      const controller = new MediaNotificationController(item);
      controller.calculate();

      const notification = controller.getNotification();
      expect(notification.heading?.text).toBe('Person');
      expect(notification.metadata).toEqual([]);
      expect(notification.body).toEqual({ text: 'Test Description' });
    });

    it('should get notification with a seek detail', () => {
      const controller = new MediaNotificationController(new TestViewMedia());
      controller.calculate({ seek: new Date('2025-05-20T07:14:57Z') });

      expect(controller.getNotification().metadata).toContainEqual(
        expect.objectContaining({ tooltip: 'Seek' }),
      );
    });

    it('should get notification without media', () => {
      const item = new ViewFolder(createFolder(), []);

      const controller = new MediaNotificationController(item);
      controller.calculate();

      const notification = controller.getNotification();
      expect(notification.body).toBeUndefined();
    });

    it('should get notification with null description', () => {
      const item = new TestViewMedia({
        description: null,
      });

      const controller = new MediaNotificationController(item);
      controller.calculate();

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
      vi.mocked(cardAPI.getCardElementManager().getElement).mockReturnValue(
        mock<HTMLElement>(),
      );
      const viewItemManager = mock<ViewItemManager>();

      const context = {
        capabilities: {
          canFavorite: true,
          canDownload: true,
        },
        viewItemManager: viewItemManager,
        viewManagerEpoch: viewManagerEpoch,
      };

      const controller = new MediaNotificationController(item);
      controller.calculate();

      const notification = controller.getNotification(context);
      const controls = notification.controls;
      assert(controls);
      expect(controls).toHaveLength(4);

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

      const controller = new MediaNotificationController(item);
      controller.calculate();

      const notification = controller.getNotification(context);
      const controls = notification.controls;
      expect(controls).toHaveLength(2);

      expect(controls?.[0].tooltip).toBe('Mark as unreviewed');
      expect(controls?.[0].icon).toBe('mdi:check-circle');
      expect(controls?.[0].className).toBe('reviewed');

      expect(controls?.[1].icon).toBe('mdi:star');
      expect(controls?.[1].className).toBe('favorited');
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

      const controller = new MediaNotificationController(item);
      controller.calculate();

      const notification = controller.getNotification(context);
      expect(notification.controls).toHaveLength(0);
    });

    it('should get notification with controls when context has no capabilities', () => {
      const item = new TestViewMedia({
        id: 'id',
      });
      const context = {};

      const controller = new MediaNotificationController(item);
      controller.calculate();

      const notification = controller.getNotification(context);
      expect(notification.controls).toHaveLength(0);
    });
  });
});
