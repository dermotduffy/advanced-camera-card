import { MediaDetailsController } from '../../../components-lib/media/details-controller';
import { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class InfoAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const item = api.getViewManager().getView()?.queryResults?.getSelectedResult();
    if (!ViewItemClassifier.isMedia(item)) {
      return;
    }

    const controller = new MediaDetailsController();
    controller.calculate(api.getCameraManager(), item);

    api.getOverlayMessageManager().setMessage(
      controller.getMessage({
        hass: api.getHASSManager().getHASS() ?? undefined,
        viewItemManager: api.getViewItemManager(),
        viewManagerEpoch: api.getViewManager().getEpoch(),
        capabilities: api.getViewItemManager().getCapabilities(item),
      }),
    );
  }
}
