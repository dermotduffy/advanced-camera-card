import { ViewItemManager } from '../card-controller/view/item-manager';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { ViewItem } from '../view/item';
import { ViewItemClassifier } from '../view/item-classifier';
import { errorToConsole } from './basic';

interface MediaActionOptions {
  viewItemManager?: ViewItemManager;
  viewManagerEpoch?: ViewManagerEpoch;
}

export async function toggleReviewed(
  item: ViewItem,
  options: MediaActionOptions,
): Promise<boolean> {
  if (!ViewItemClassifier.isReview(item) || !options.viewItemManager) {
    return false;
  }

  const newState = !item.isReviewed();
  try {
    await options.viewItemManager.reviewMedia(item, newState);
  } catch (e) {
    errorToConsole(e as Error);
    return false;
  }
  item.setReviewed(newState);

  // Remove from view results
  const view = options.viewManagerEpoch?.manager.getView();
  if (view?.queryResults) {
    options.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        queryResults: view.queryResults.clone().removeItem(item),
      },
    });
  }
  return true;
}

export async function toggleFavorite(
  item: ViewItem,
  options: MediaActionOptions,
): Promise<boolean> {
  if (!ViewItemClassifier.isMedia(item) || !options.viewItemManager) {
    return false;
  }

  const newState = !item.isFavorite();
  try {
    await options.viewItemManager.favorite(item, newState);
  } catch (e) {
    errorToConsole(e as Error);
    return false;
  }
  return true;
}

export async function downloadMedia(
  item: ViewItem,
  options: MediaActionOptions,
): Promise<boolean> {
  if (!options.viewItemManager) {
    return false;
  }

  try {
    await options.viewItemManager.download(item);
  } catch (e) {
    errorToConsole(e as Error);
    return false;
  }
  return true;
}

export function navigateToTimeline(item: ViewItem, options: MediaActionOptions): void {
  if (!options.viewManagerEpoch) {
    return;
  }

  options.viewManagerEpoch.manager.setViewByParameters({
    params: {
      view: 'timeline',
      queryResults: options.viewManagerEpoch.manager
        .getView()
        ?.queryResults?.clone()
        .selectResultIfFound((media) => media === item),
    },
    modifiers: [new RemoveContextViewModifier(['timeline'])],
  });
}
