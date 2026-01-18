import { describe, expect, it, vi } from 'vitest';
import { CallServiceAction } from '../../../src/card-controller/actions/actions/call-service';
import { CameraSelectAction } from '../../../src/card-controller/actions/actions/camera-select';
import { CameraUIAction } from '../../../src/card-controller/actions/actions/camera-ui';
import { CustomAction } from '../../../src/card-controller/actions/actions/custom';
import { DefaultAction } from '../../../src/card-controller/actions/actions/default';
import { DisplayModeSelectAction } from '../../../src/card-controller/actions/actions/display-mode-select';
import { DownloadAction } from '../../../src/card-controller/actions/actions/download';
import { EffectAction } from '../../../src/card-controller/actions/actions/effect';
import { ExpandAction } from '../../../src/card-controller/actions/actions/expand';
import { FullscreenAction } from '../../../src/card-controller/actions/actions/fullscreen';
import { InfoAction } from '../../../src/card-controller/actions/actions/info';
import { InternalCallbackAction } from '../../../src/card-controller/actions/actions/internal-callback';
import { LogAction } from '../../../src/card-controller/actions/actions/log';
import { MediaPlayerAction } from '../../../src/card-controller/actions/actions/media-player';
import { MenuToggleAction } from '../../../src/card-controller/actions/actions/menu-toggle';
import { MicrophoneConnectAction } from '../../../src/card-controller/actions/actions/microphone-connect';
import { MicrophoneDisconnectAction } from '../../../src/card-controller/actions/actions/microphone-disconnect';
import { MicrophoneMuteAction } from '../../../src/card-controller/actions/actions/microphone-mute';
import { MicrophoneUnmuteAction } from '../../../src/card-controller/actions/actions/microphone-unmute';
import { MoreInfoAction } from '../../../src/card-controller/actions/actions/more-info';
import { MuteAction } from '../../../src/card-controller/actions/actions/mute';
import { NavigateAction } from '../../../src/card-controller/actions/actions/navigate';
import { NoneAction } from '../../../src/card-controller/actions/actions/none';
import { PauseAction } from '../../../src/card-controller/actions/actions/pause';
import { PerformActionAction } from '../../../src/card-controller/actions/actions/perform-action';
import { PlayAction } from '../../../src/card-controller/actions/actions/play';
import { PTZAction } from '../../../src/card-controller/actions/actions/ptz';
import { PTZControlsAction } from '../../../src/card-controller/actions/actions/ptz-controls';
import { PTZDigitalAction } from '../../../src/card-controller/actions/actions/ptz-digital';
import { PTZMultiAction } from '../../../src/card-controller/actions/actions/ptz-multi';
import { ReloadAction } from '../../../src/card-controller/actions/actions/reload';
import { ScreenshotAction } from '../../../src/card-controller/actions/actions/screenshot';
import { SetReviewAction } from '../../../src/card-controller/actions/actions/set-review';
import { SleepAction } from '../../../src/card-controller/actions/actions/sleep';
import { StatusBarAction } from '../../../src/card-controller/actions/actions/status-bar';
import { SubstreamOffAction } from '../../../src/card-controller/actions/actions/substream-off';
import { SubstreamOnAction } from '../../../src/card-controller/actions/actions/substream-on';
import { SubstreamSelectAction } from '../../../src/card-controller/actions/actions/substream-select';
import { ToggleAction } from '../../../src/card-controller/actions/actions/toggle';
import { UnmuteAction } from '../../../src/card-controller/actions/actions/unmute';
import { URLAction } from '../../../src/card-controller/actions/actions/url';
import { ViewAction } from '../../../src/card-controller/actions/actions/view';
import { ActionFactory } from '../../../src/card-controller/actions/factory';
import { INTERNAL_CALLBACK_ACTION } from '../../../src/config/schema/actions/custom/internal';
import { ActionConfig } from '../../../src/config/schema/actions/types';

// @vitest-environment jsdom
describe('ActionFactory', () => {
  it('mismatched card-id', () => {
    const factory = new ActionFactory();
    expect(
      factory.createAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'clip',
          card_id: 'card_id',
        },
        {
          cardID: 'different_card_id',
        },
      ),
    ).toBeNull();
  });

  describe('stock actions', () => {
    it.each([
      [{ action: 'more-info' as const }, MoreInfoAction],
      [{ action: 'toggle' as const }, ToggleAction],
      [{ action: 'navigate' as const, navigation_path: '/foo' }, NavigateAction],
      [{ action: 'url' as const, url_path: 'https://card.camera' }, URLAction],
      [
        { action: 'perform-action' as const, perform_action: 'action' },
        PerformActionAction,
      ],
      [{ action: 'call-service' as const, service: 'service' }, CallServiceAction],
      [{ action: 'none' as const }, NoneAction],
      [{ action: 'fire-dom-event' as const }, CustomAction],
    ])('action: $action', (action: ActionConfig, classObject: object) => {
      const factory = new ActionFactory();
      expect(factory.createAction({}, action)).toBeInstanceOf(classObject);
    });
  });

  describe('custom actions', () => {
    it.each([
      [{ advanced_camera_card_action: 'camera_select' as const }, CameraSelectAction],
      [{ advanced_camera_card_action: 'camera_ui' as const }, CameraUIAction],
      [{ advanced_camera_card_action: 'clip' as const }, ViewAction],
      [{ advanced_camera_card_action: 'clips' as const }, ViewAction],
      [{ advanced_camera_card_action: 'default' as const }, DefaultAction],
      [{ advanced_camera_card_action: 'diagnostics' as const }, ViewAction],
      [
        {
          advanced_camera_card_action: 'display_mode_select' as const,
          display_mode: 'single' as const,
        },
        DisplayModeSelectAction,
      ],
      [{ advanced_camera_card_action: 'download' as const }, DownloadAction],
      [{ advanced_camera_card_action: 'expand' as const }, ExpandAction],
      [{ advanced_camera_card_action: 'folder' as const }, ViewAction],
      [{ advanced_camera_card_action: 'folders' as const }, ViewAction],
      [{ advanced_camera_card_action: 'fullscreen' as const }, FullscreenAction],
      [{ advanced_camera_card_action: 'info' as const }, InfoAction],
      [{ advanced_camera_card_action: 'image' as const }, ViewAction],
      [
        { advanced_camera_card_action: 'live_substream_off' as const },
        SubstreamOffAction,
      ],
      [{ advanced_camera_card_action: 'live_substream_on' as const }, SubstreamOnAction],
      [
        {
          advanced_camera_card_action: 'live_substream_select' as const,
          camera: 'camera.office',
        },
        SubstreamSelectAction,
      ],
      [{ advanced_camera_card_action: 'live' as const }, ViewAction],
      [
        {
          advanced_camera_card_action: 'log' as const,
          message: 'Hello, world!' as const,
        },
        LogAction,
      ],
      [
        {
          advanced_camera_card_action: 'media_player' as const,
          media_player: 'media_player.foo' as const,
          media_player_action: 'play' as const,
        },
        MediaPlayerAction,
      ],
      [{ advanced_camera_card_action: 'menu_toggle' as const }, MenuToggleAction],
      [
        { advanced_camera_card_action: 'microphone_connect' as const },
        MicrophoneConnectAction,
      ],
      [
        { advanced_camera_card_action: 'microphone_disconnect' as const },
        MicrophoneDisconnectAction,
      ],
      [
        { advanced_camera_card_action: 'microphone_mute' as const },
        MicrophoneMuteAction,
      ],
      [
        { advanced_camera_card_action: 'microphone_unmute' as const },
        MicrophoneUnmuteAction,
      ],
      [{ advanced_camera_card_action: 'mute' as const }, MuteAction],
      [{ advanced_camera_card_action: 'pause' as const }, PauseAction],
      [{ advanced_camera_card_action: 'play' as const }, PlayAction],
      [{ advanced_camera_card_action: 'ptz_digital' as const }, PTZDigitalAction],
      [
        {
          advanced_camera_card_action: 'ptz_multi' as const,
          ptz_action: 'right' as const,
        },
        PTZMultiAction,
      ],
      [
        { advanced_camera_card_action: 'ptz' as const, ptz_action: 'right' as const },
        PTZAction,
      ],
      [{ advanced_camera_card_action: 'recording' as const }, ViewAction],
      [{ advanced_camera_card_action: 'recordings' as const }, ViewAction],
      [{ advanced_camera_card_action: 'screenshot' as const }, ScreenshotAction],
      [
        { advanced_camera_card_action: 'ptz_controls' as const, enabled: true },
        PTZControlsAction,
      ],
      [{ advanced_camera_card_action: 'sleep' as const }, SleepAction],
      [{ advanced_camera_card_action: 'snapshot' as const }, ViewAction],
      [{ advanced_camera_card_action: 'snapshots' as const }, ViewAction],
      [{ advanced_camera_card_action: 'timeline' as const }, ViewAction],
      [{ advanced_camera_card_action: 'unmute' as const }, UnmuteAction],
      [
        {
          advanced_camera_card_action: 'status_bar' as const,
          status_bar_action: 'reset',
        },
        StatusBarAction,
      ],
      [
        {
          advanced_camera_card_action: INTERNAL_CALLBACK_ACTION,
          callback: vi.fn(),
        },
        InternalCallbackAction,
      ],
      [{ advanced_camera_card_action: 'reload' as const }, ReloadAction],
      [{ advanced_camera_card_action: 'set_review' as const }, SetReviewAction],
      [{ advanced_camera_card_action: 'effect' as const }, EffectAction],
    ])(
      'advanced_camera_card_action: $advanced_camera_card_action',
      (action: Partial<ActionConfig>, classObject: object) => {
        const factory = new ActionFactory();
        expect(
          factory.createAction({}, { ...action, action: 'fire-dom-event' }),
        ).toBeInstanceOf(classObject);
      },
    );
  });
});
