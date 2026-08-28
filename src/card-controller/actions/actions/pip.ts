import type { ReadonlyDeep } from 'type-fest';

import type { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class PIPAction extends AdvancedCameraCardAction<
  ReadonlyDeep<GeneralActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);
    await api.getPIPManager().togglePIP();
  }
}
