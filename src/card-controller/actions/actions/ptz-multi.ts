import { PTZMultiActionConfig } from '../../../config/schema/actions/custom/ptz-multi';
import { createPTZAction, createPTZDigitalAction } from '../../../utils/action';
import { getPTZTarget, hasCameraTruePTZ, PTZType } from '../../../utils/ptz';
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

    const action = this._getAction();
    if (action.target_id) {
      targetID = action.target_id;
      type = hasCameraTruePTZ(api.getCameraManager(), targetID) ? 'ptz' : 'digital';
    } else if (view) {
      const multiTarget = getPTZTarget(view, { cameraManager: api.getCameraManager() });
      targetID = multiTarget?.targetID ?? null;
      type = multiTarget?.type ?? null;
    }

    if (!targetID || type === null) {
      return;
    }

    void (
      type === 'ptz' ? this._toPTZAction(targetID) : this._toPTZDigitalAction(targetID)
    ).execute(api);
  }

  private _toPTZAction(targetID: string): PTZAction {
    const action = this._getAction();
    return new PTZAction(
      this._context,
      createPTZAction({
        cardID: action.card_id,
        cameraID: targetID,
        ptzAction: action.ptz_action,
        ptzPhase: action.ptz_phase,
        ptzPreset: action.ptz_preset,
      }),
      this._config,
    );
  }

  private _toPTZDigitalAction(targetID: string): PTZDigitalAction {
    const action = this._getAction();
    return new PTZDigitalAction(
      this._context,
      createPTZDigitalAction({
        cardID: action.card_id,
        ptzPhase: action.ptz_phase,
        ptzAction: action.ptz_action,
        targetID: targetID,
      }),
      this._config,
    );
  }
}
