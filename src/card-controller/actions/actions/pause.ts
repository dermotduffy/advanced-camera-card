import type { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class PauseAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await api
      .getMediaLoadedInfoManager()
      .get()
      ?.mediaPlayerController?.playback?.pause();
  }
}
