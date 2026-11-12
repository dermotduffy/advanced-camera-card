import type { ReadonlyDeep } from 'type-fest';

import type { CallStartActionConfig } from '../../../config/schema/actions/custom/call-start';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallStartAction extends AdvancedCameraCardAction<
  ReadonlyDeep<CallStartActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    await api.getCallManager().start({
      cameraID: action.camera,
      streamID: action.stream,
    });
  }
}
