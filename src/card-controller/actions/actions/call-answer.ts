import type { CallAnswerActionConfig } from '../../../config/schema/actions/custom/call-answer';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallAnswerAction extends AdvancedCameraCardAction<CallAnswerActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getCallManager().answer();
  }
}
