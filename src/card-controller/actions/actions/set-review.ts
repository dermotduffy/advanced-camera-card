import { SetReviewActionConfig } from '../../../config/schema/actions/custom/set-review';
import { toggleReviewed } from '../../../utils/media-actions';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { getReviewedQueryFilterFromQuery } from '../../../view/utils/query-filter';
import { CardActionsAPI } from '../../types';
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

    const targetReviewedState = this._action.reviewed;
    if (targetReviewedState !== undefined && targetReviewedState === item.isReviewed()) {
      return;
    }

    const results = await Promise.all([
      toggleReviewed(
        item,
        api.getViewItemManager(),
        viewManager.getEpoch(),
        getReviewedQueryFilterFromQuery(view?.query, item),
      ),
      api.getEffectsManager().startEffect('check', {
        duration: 0.4,
        fadeIn: false,
      }),
    ]);

    // Trigger UI update to refresh menu icon state
    if (results[0]) {
      api.getCardElementManager().update();
    }
  }
}
