import { CallEndActionConfig } from '../../../config/schema/actions/custom/call-end';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallEndAction extends AdvancedCameraCardAction<CallEndActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getCallManager().end();
  }
}
