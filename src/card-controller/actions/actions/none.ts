import type { ReadonlyDeep } from 'type-fest';

import type { NoneActionConfig } from '../../../config/schema/actions/stock/none';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class NoneAction extends AdvancedCameraCardAction<
  ReadonlyDeep<NoneActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);
  }
}
