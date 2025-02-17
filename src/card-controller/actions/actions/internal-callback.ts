import { InternalCallbackActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class InternalCallbackAction extends AdvancedCameraCardAction<InternalCallbackActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await this._action.callback(api);
  }
}
