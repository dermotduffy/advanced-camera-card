import { CallStartActionConfig } from '../../../config/schema/actions/custom/call-start';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallStartAction extends AdvancedCameraCardAction<CallStartActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await api.getCallManager().start(this._action.camera);
  }
}
