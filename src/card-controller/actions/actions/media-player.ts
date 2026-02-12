import { MediaPlayerActionConfig } from '../../../config/schema/actions/custom/media-player';
import { getStreamCameraID } from '../../../utils/substream';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class MediaPlayerAction extends AdvancedCameraCardAction<MediaPlayerActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const mediaPlayer = this._action.media_player;
    const mediaPlayerController = api.getMediaPlayerManager();

    if (this._action.media_player_action === 'stop') {
      await mediaPlayerController.stop(mediaPlayer);
      return;
    }

    const view = api.getViewManager().getView();
    const item = view?.queryResults?.getSelectedResult() ?? null;

    if (view?.is('live')) {
      const cameraID = getStreamCameraID(view);
      if (cameraID) {
        await mediaPlayerController.playLive(mediaPlayer, cameraID);
      }
    } else if (view?.isViewerView() && item && ViewItemClassifier.isMedia(item)) {
      await mediaPlayerController.playMedia(mediaPlayer, item);
    }
  }
}
