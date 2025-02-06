import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class FullscreenAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getFullscreenManager().toggleFullscreen();
  }
}
