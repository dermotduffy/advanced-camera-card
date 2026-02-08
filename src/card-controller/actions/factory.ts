import { ActionContext } from 'action';
import { INTERNAL_CALLBACK_ACTION } from '../../config/schema/actions/custom/internal';
import { ActionConfig, AuxillaryActionConfig } from '../../config/schema/actions/types';
import { isAdvancedCameraCardCustomAction } from '../../utils/action';
import { CallServiceAction } from './actions/call-service';
import { CameraSelectAction } from './actions/camera-select';
import { CameraUIAction } from './actions/camera-ui';
import { CustomAction } from './actions/custom';
import { DefaultAction } from './actions/default';
import { DisplayModeSelectAction } from './actions/display-mode-select';
import { DownloadAction } from './actions/download';
import { EffectAction } from './actions/effect';
import { ExpandAction } from './actions/expand';
import { FullscreenAction } from './actions/fullscreen';
import { InfoAction } from './actions/info';
import { InternalCallbackAction } from './actions/internal-callback';
import { LogAction } from './actions/log';
import { MediaPlayerAction } from './actions/media-player';
import { MenuToggleAction } from './actions/menu-toggle';
import { MicrophoneConnectAction } from './actions/microphone-connect';
import { MicrophoneDisconnectAction } from './actions/microphone-disconnect';
import { MicrophoneMuteAction } from './actions/microphone-mute';
import { MicrophoneUnmuteAction } from './actions/microphone-unmute';
import { MoreInfoAction } from './actions/more-info';
import { MuteAction } from './actions/mute';
import { NavigateAction } from './actions/navigate';
import { NoneAction } from './actions/none';
import { PauseAction } from './actions/pause';
import { PerformActionAction } from './actions/perform-action';
import { PlayAction } from './actions/play';
import { PTZAction } from './actions/ptz';
import { PTZControlsAction } from './actions/ptz-controls';
import { PTZDigitalAction } from './actions/ptz-digital';
import { PTZMultiAction } from './actions/ptz-multi';
import { ReloadAction } from './actions/reload';
import { ScreenshotAction } from './actions/screenshot';
import { SetReviewAction } from './actions/set-review';
import { SleepAction } from './actions/sleep';
import { StatusBarAction } from './actions/status-bar';
import { SubstreamOffAction } from './actions/substream-off';
import { SubstreamOnAction } from './actions/substream-on';
import { SubstreamSelectAction } from './actions/substream-select';
import { ToggleAction } from './actions/toggle';
import { UnmuteAction } from './actions/unmute';
import { URLAction } from './actions/url';
import { ViewAction } from './actions/view';
import { Action } from './types';

export class ActionFactory {
  public createAction(
    context: ActionContext,
    action: ActionConfig,
    options?: {
      config?: AuxillaryActionConfig;
      cardID?: string;
    },
  ): Action | null {
    if (
      // Command not intended for this card (e.g. query string command).
      action.card_id &&
      action.card_id !== options?.cardID
    ) {
      return null;
    }

    switch (action.action) {
      case 'more-info':
        return new MoreInfoAction(context, action, options?.config);
      case 'toggle':
        return new ToggleAction(context, action, options?.config);
      case 'navigate':
        return new NavigateAction(context, action, options?.config);
      case 'url':
        return new URLAction(context, action, options?.config);
      case 'perform-action':
        return new PerformActionAction(context, action, options?.config);
      case 'call-service':
        return new CallServiceAction(context, action, options?.config);
      case 'none':
        return new NoneAction(context, action, options?.config);
    }

    if (!isAdvancedCameraCardCustomAction(action)) {
      return new CustomAction(context, action, options?.config);
    }

    switch (action.advanced_camera_card_action) {
      case 'default':
        return new DefaultAction(context, action, options?.config);
      case 'clip':
      case 'clips':
      case 'folder':
      case 'folders':
      case 'gallery':
      case 'image':
      case 'live':
      case 'media':
      case 'recording':
      case 'recordings':
      case 'review':
      case 'reviews':
      case 'snapshot':
      case 'snapshots':
      case 'timeline':
      case 'diagnostics':
        return new ViewAction(context, action, options?.config);
      case 'sleep':
        return new SleepAction(context, action, options?.config);
      case 'download':
        return new DownloadAction(context, action, options?.config);
      case 'camera_ui':
        return new CameraUIAction(context, action, options?.config);
      case 'effect':
        return new EffectAction(context, action, options?.config);
      case 'expand':
        return new ExpandAction(context, action, options?.config);
      case 'fullscreen':
        return new FullscreenAction(context, action, options?.config);
      case 'info':
        return new InfoAction(context, action, options?.config);
      case 'menu_toggle':
        return new MenuToggleAction(context, action, options?.config);
      case 'camera_select':
        return new CameraSelectAction(context, action, options?.config);
      case 'live_substream_select':
        return new SubstreamSelectAction(context, action, options?.config);
      case 'live_substream_off':
        return new SubstreamOffAction(context, action, options?.config);
      case 'live_substream_on':
        return new SubstreamOnAction(context, action, options?.config);
      case 'media_player':
        return new MediaPlayerAction(context, action, options?.config);
      case 'microphone_connect':
        return new MicrophoneConnectAction(context, action, options?.config);
      case 'microphone_disconnect':
        return new MicrophoneDisconnectAction(context, action, options?.config);
      case 'microphone_mute':
        return new MicrophoneMuteAction(context, action, options?.config);
      case 'microphone_unmute':
        return new MicrophoneUnmuteAction(context, action, options?.config);
      case 'mute':
        return new MuteAction(context, action, options?.config);
      case 'unmute':
        return new UnmuteAction(context, action, options?.config);
      case 'play':
        return new PlayAction(context, action, options?.config);
      case 'pause':
        return new PauseAction(context, action, options?.config);
      case 'screenshot':
        return new ScreenshotAction(context, action, options?.config);
      case 'display_mode_select':
        return new DisplayModeSelectAction(context, action, options?.config);
      case 'ptz':
        return new PTZAction(context, action, options?.config);
      case 'ptz_digital':
        return new PTZDigitalAction(context, action, options?.config);
      case 'ptz_multi':
        return new PTZMultiAction(context, action, options?.config);
      case 'ptz_controls':
        return new PTZControlsAction(context, action, options?.config);
      case 'log':
        return new LogAction(context, action, options?.config);
      case 'status_bar':
        return new StatusBarAction(context, action, options?.config);
      case 'reload':
        return new ReloadAction(context, action, options?.config);
      case 'set_review':
        return new SetReviewAction(context, action, options?.config);
      case INTERNAL_CALLBACK_ACTION:
        return new InternalCallbackAction(context, action, options?.config);
    }

    /* istanbul ignore next: this path cannot be reached -- @preserve */
    console.warn(
      `Advanced Camera Card received unknown card action: ${action['advanced_camera_card_action']}`,
    );
    /* istanbul ignore next: this path cannot be reached -- @preserve */
    return null;
  }
}
