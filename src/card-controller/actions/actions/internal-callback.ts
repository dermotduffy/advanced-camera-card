import { InternalCallbackActionConfig } from '../../../config/schema/actions/custom/internal';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class InternalCallbackAction extends AdvancedCameraCardAction<InternalCallbackActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await this._action.callback(api);
  }
}
