import { LogActionConfig } from '../../../config/schema/actions/custom/log';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class LogAction extends AdvancedCameraCardAction<LogActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    console[this._action.level](this._action.message);
  }
}
