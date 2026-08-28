import type { ReadonlyDeep } from 'type-fest';

import type { InternalCallbackActionConfig } from '../../../config/schema/actions/custom/internal';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class InternalCallbackAction extends AdvancedCameraCardAction<
  ReadonlyDeep<InternalCallbackActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await this._getAction().callback(api);
  }
}
