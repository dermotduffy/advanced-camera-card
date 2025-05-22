import { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import { downloadURL } from '../../../utils/download';
import { generateScreenshotFilename } from '../../../utils/screenshot';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ScreenshotAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const url = await api
      .getMediaLoadedInfoManager()
      .get()
      ?.mediaPlayerController?.getScreenshotURL();

    if (url) {
      downloadURL(url, generateScreenshotFilename(api.getViewManager().getView()));
    }
  }
}
