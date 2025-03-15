import { SleepActionConfig } from '../../../config/types';
import { sleep } from '../../../utils/basic';
import { CardActionsAPI } from '../../types';
import { timeDeltaToSeconds } from '../utils/time-delta';
import { AdvancedCameraCardAction } from './base';

export class SleepAction extends AdvancedCameraCardAction<SleepActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await sleep(timeDeltaToSeconds(this._action.duration));
  }
}
