import type { SetReviewActionConfig } from '../../../config/schema/actions/custom/set-review';
import { toggleReviewed } from '../../../utils/media-actions';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { getBooleanQueryFilter } from '../../../view/utils/query-filter';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class SetReviewAction extends AdvancedCameraCardAction<SetReviewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const viewManager = api.getViewManager();
    const view = viewManager.getView();
    const queryResults = view?.queryResults;
    const item = queryResults?.getSelectedResult();

    if (!ViewItemClassifier.isReview(item) || !queryResults) {
      return;
    }

    const targetReviewedState = this._getAction().reviewed;
    if (targetReviewedState !== undefined && targetReviewedState === item.isReviewed()) {
      return;
    }

    await toggleReviewed(
      api.getCardElementManager().getElement(),
      item,
      api.getViewItemManager(),
      viewManager.getEpoch(),
      getBooleanQueryFilter('reviewed', view?.query, item) ?? undefined,
    );
  }
}
