import type { CameraManager } from '../camera-manager/manager';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request';
import type { ViewItemManager } from '../card-controller/view/item-manager';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context';
import { RemoveItemViewModifier } from '../card-controller/view/modifiers/remove-item';
import { UpdateItemViewModifier } from '../card-controller/view/modifiers/update-item';
import type { ViewManagerEpoch } from '../card-controller/view/types';
import {
  MediaNotificationController,
  type NotificationControlsContext,
} from '../components-lib/notification/media-controller';
import type { ViewItem } from '../view/item';
import { ViewItemClassifier } from '../view/item-classifier';
import { createNotificationAction } from './action';
import { errorToConsole } from './basic';
import { fireAdvancedCameraCardEvent } from './fire-advanced-camera-card-event';

const replaceItemInView = (
  item: ViewItem,
  removeItem: boolean,
  viewManagerEpoch?: ViewManagerEpoch,
): void =>
  viewManagerEpoch?.manager.setViewWithModifiers([
    removeItem ? new RemoveItemViewModifier(item) : new UpdateItemViewModifier(item),
  ]);

export async function toggleReviewed(
  host: HTMLElement,
  item: ViewItem,
  viewItemManager?: ViewItemManager,
  viewManagerEpoch?: ViewManagerEpoch,
  filterReviewed?: boolean,
): Promise<boolean> {
  if (!ViewItemClassifier.isReview(item) || !viewItemManager) {
    return false;
  }

  const newState = !item.isReviewed();
  try {
    await viewItemManager.reviewMedia(item, newState);
  } catch (e) {
    errorToConsole(e);
    return false;
  }

  replaceItemInView(
    item,
    filterReviewed !== undefined && filterReviewed !== newState,
    viewManagerEpoch,
  );

  // Provide visual feedback on review.
  fireAdvancedCameraCardEvent<ViewItem>(host, 'media:reviewed', item);

  return true;
}

export async function toggleFavorite(
  item: ViewItem,
  viewItemManager?: ViewItemManager,
  viewManagerEpoch?: ViewManagerEpoch,
  filterFavorite?: boolean,
): Promise<boolean> {
  if (!ViewItemClassifier.isMedia(item) || !viewItemManager) {
    return false;
  }

  const newState = !item.isFavorite();
  try {
    await viewItemManager.favorite(item, newState);
  } catch (e) {
    errorToConsole(e);
    return false;
  }

  replaceItemInView(
    item,
    filterFavorite !== undefined && filterFavorite !== newState,
    viewManagerEpoch,
  );

  return true;
}

export async function downloadMedia(
  item: ViewItem,
  viewItemManager?: ViewItemManager,
): Promise<boolean> {
  if (!viewItemManager) {
    return false;
  }

  try {
    await viewItemManager.download(item);
  } catch (e) {
    errorToConsole(e);
    return false;
  }
  return true;
}

export function navigateToTimeline(
  item: ViewItem,
  viewManagerEpoch?: ViewManagerEpoch,
): void {
  if (!viewManagerEpoch) {
    return;
  }

  viewManagerEpoch.manager.setViewByParameters({
    params: {
      view: 'timeline',
      queryResults: viewManagerEpoch.manager
        .getView()
        ?.queryResults?.clone()
        .selectResultIfFound((media) => item.isSameAs(media)),
    },
    modifiers: [new RemoveContextViewModifier(['timeline'])],
  });
}

export function showMediaInfoNotification(
  host: HTMLElement,
  item: ViewItem,
  context: NotificationControlsContext,
  cameraManager?: CameraManager,
): void {
  const notificationController = new MediaNotificationController(item);
  notificationController.calculate({ cameraManager });

  dispatchActionExecutionRequest(host, {
    actions: [createNotificationAction(notificationController.getNotification(context))],
  });
}
