import type { ReadonlyDeep } from 'type-fest';

import type { CallEndActionConfig } from '../../../config/schema/actions/custom/call-end';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallEndAction extends AdvancedCameraCardAction<
  ReadonlyDeep<CallEndActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getCallManager().end();
  }
}
