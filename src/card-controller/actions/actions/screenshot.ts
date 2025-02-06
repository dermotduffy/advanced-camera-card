import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ScreenshotAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await api.getDownloadManager().downloadScreenshot();
  }
}
