import { PTZMultiActionConfig } from '../../../config/types';
import { createPTZAction, createPTZDigitalAction } from '../../../utils/action';
import { PTZType, getPTZTarget, hasCameraTruePTZ } from '../../../utils/ptz';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';
import { PTZAction } from './ptz';
import { PTZDigitalAction } from './ptz-digital';

export class PTZMultiAction extends AdvancedCameraCardAction<PTZMultiActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const view = api.getViewManager().getView();
    let targetID: string | null = null;
    let type: PTZType | null = null;

    if (this._action.target_id) {
      targetID = this._action.target_id;
      type = hasCameraTruePTZ(api.getCameraManager(), targetID) ? 'ptz' : 'digital';
    } else if (view) {
      const multiTarget = getPTZTarget(view, { cameraManager: api.getCameraManager() });
      targetID = multiTarget?.targetID ?? null;
      type = multiTarget?.type ?? null;
    }

    if (!targetID || type === null) {
      return;
    }

    (type === 'ptz'
      ? this._toPTZAction(targetID)
      : this._toPTZDigitalAction(targetID)
    ).execute(api);
  }

  protected _toPTZAction(targetID: string): PTZAction {
    return new PTZAction(
      this._context,
      createPTZAction({
        cardID: this._action.card_id,
        cameraID: targetID,
        ptzAction: this._action.ptz_action,
        ptzPhase: this._action.ptz_phase,
        ptzPreset: this._action.ptz_preset,
      }),
      this._config,
    );
  }

  protected _toPTZDigitalAction(targetID: string): PTZDigitalAction {
    return new PTZDigitalAction(
      this._context,
      createPTZDigitalAction({
        cardID: this._action.card_id,
        ptzPhase: this._action.ptz_phase,
        ptzAction: this._action.ptz_action,
        targetID: targetID,
      }),
      this._config,
    );
  }
}
