import { SetReviewActionConfig } from '../../../config/schema/actions/custom/set-review';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class SetReviewAction extends AdvancedCameraCardAction<SetReviewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const view = api.getViewManager().getView();
    const queryResults = view?.queryResults;
    const item = queryResults?.getSelectedResult();

    if (!ViewItemClassifier.isReview(item) || !queryResults) {
      return;
    }

    const targetReviewedState = this._action.reviewed ?? !item.isReviewed();

    await api.getViewItemManager().reviewMedia(item, targetReviewedState);

    // Clone the item to ensure Lit detects the change.
    // Test-case: Setting a media item reviewed via the menu, should update the
    // reviewed state in a thumbnail.
    const clonedItem = item.clone();
    clonedItem.setReviewed(targetReviewedState);

    api.getViewManager().setViewByParameters({
      params: {
        queryResults: queryResults.clone().replaceItem(item, clonedItem),
      },
    });
  }
}
