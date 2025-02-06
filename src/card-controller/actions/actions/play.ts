import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class PlayAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await api.getMediaLoadedInfoManager().get()?.player?.play();
  }
}
