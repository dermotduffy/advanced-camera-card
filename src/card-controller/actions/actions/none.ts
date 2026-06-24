import type { NoneActionConfig } from '../../../config/schema/actions/stock/none';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class NoneAction extends AdvancedCameraCardAction<NoneActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);
  }
}
