import { CameraSelectActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CameraSelectAction extends AdvancedCameraCardAction<CameraSelectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const selectCameraID =
      this._action.camera ??
      (this._action.triggered
        ? api.getTriggersManager().getMostRecentlyTriggeredCameraID()
        : null);
    const view = api.getViewManager().getView();
    const config = api.getConfigManager().getConfig();

    // Don't do anything if the camera is already selected (especially important
    // for control entities, as otherwise every camera change will generate a
    // double request for events, once when the camera changes and another when
    // the observed state of the control entity changes to match).
    if (selectCameraID && view && selectCameraID !== view.camera) {
      const viewOnCameraSelect = config?.view.camera_select ?? 'current';
      const targetViewName =
        viewOnCameraSelect === 'current' ? view.view : viewOnCameraSelect;
      await api.getViewManager().setViewByParametersWithNewQuery({
        params: {
          view: targetViewName,
          camera: selectCameraID,
        },
        failSafe: true,
      });
    }
  }
}
