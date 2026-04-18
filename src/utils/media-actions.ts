import { ViewItemManager } from '../card-controller/view/item-manager';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { ViewItem } from '../view/item';
import { ViewItemClassifier } from '../view/item-classifier';
import { errorToConsole } from './basic';

export async function toggleReviewed(
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
    errorToConsole(e as Error);
    return false;
  }
  item.setReviewed(newState);

  // Only remove from query results if the new state conflicts with the filter:
  // - If filter is 'false' (unreviewed only) and we toggled TO reviewed → remove
  // - If filter is 'true' (reviewed only) and we toggled TO unreviewed → remove
  // - If filter is 'undefined' (both) → never remove
  const shouldRemove = filterReviewed !== undefined && filterReviewed !== newState;

  if (shouldRemove) {
    const view = viewManagerEpoch?.manager.getView();
    if (view?.queryResults) {
      viewManagerEpoch?.manager.setViewByParameters({
        params: {
          queryResults: view.queryResults.clone().removeItem(item),
        },
      });
    }
  }
  return true;
}

export async function toggleFavorite(
  item: ViewItem,
  viewItemManager?: ViewItemManager,
): Promise<boolean> {
  if (!ViewItemClassifier.isMedia(item) || !viewItemManager) {
    return false;
  }

  const newState = !item.isFavorite();
  try {
    await viewItemManager.favorite(item, newState);
  } catch (e) {
    errorToConsole(e as Error);
    return false;
  }
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
    errorToConsole(e as Error);
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
        .selectResultIfFound((media) => media === item),
    },
    modifiers: [new RemoveContextViewModifier(['timeline'])],
  });
}
