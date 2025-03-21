import { NoneActionConfig } from '../../../config/schema/actions/stock/none';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class NoneAction extends AdvancedCameraCardAction<NoneActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);
  }
}
