import type { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ExpandAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getExpandManager().toggleExpanded();
  }
}
