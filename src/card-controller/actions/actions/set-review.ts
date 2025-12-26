import { SetReviewActionConfig } from '../../../config/schema/actions/custom/set-review';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class SetReviewAction extends AdvancedCameraCardAction<SetReviewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const item = api.getViewManager().getView()?.queryResults?.getSelectedResult();
    if (!ViewItemClassifier.isReview(item)) {
      return;
    }

    const targetReviewedState = this._action.reviewed ?? !item.isReviewed();

    // Update backend via ViewItemManager.
    await api.getViewItemManager().reviewMedia(item, targetReviewedState);

    // Update ViewItem's local state.
    item.setReviewed(targetReviewedState);

    // Trigger card re-render so the menu button icon updates.
    api.getCardElementManager().update();
  }
}
