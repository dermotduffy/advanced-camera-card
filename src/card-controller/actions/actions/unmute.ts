import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class UnmuteAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await api.getMediaLoadedInfoManager().get()?.mediaPlayerController?.unmute();
  }
}
