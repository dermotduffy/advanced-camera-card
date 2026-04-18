import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Camera } from '../../../../camera-manager/camera.js';
import { CameraEndpoints } from '../../../../camera-manager/types.js';
import { MicrophoneState } from '../../../../card-controller/types.js';
import { dispatchLiveErrorEvent } from '../../../../components-lib/live/utils/dispatch-live-error.js';
import { VideoMediaPlayerController } from '../../../../components-lib/media-player/video.js';
import { SignedURLController } from '../../../../components-lib/signed-url-controller.js';
import { MicrophoneConfig } from '../../../../config/schema/live.js';
import { HomeAssistant } from '../../../../ha/types.js';
import { localize } from '../../../../localize/localize.js';
import liveGo2RTCStyle from '../../../../scss/live-go2rtc.scss';
import { MediaPlayer, MediaPlayerController } from '../../../../types.js';
import { renderMessage } from '../../../message.js';
import { VideoRTC } from './video-rtc.js';

customElements.define('advanced-camera-card-live-go2rtc-player', VideoRTC);

@customElement('advanced-camera-card-live-go2rtc')
export class AdvancedCameraCardGo2RTC extends LitElement implements MediaPlayer {
  // Not a reactive property to avoid resetting the video.
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public microphoneConfig?: MicrophoneConfig;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  private _player?: VideoRTC;
  private _hasLiveError = false;

  private _mediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._player?.video ?? null,
    () => this.controls,
  );

  protected _destroyPlayer(): void {
    this._player?.disconnectNow?.();
    this._player = undefined;
  }

  private _signedURLController = new SignedURLController(
    this,
    () => {
      const endpoint = this.cameraEndpoints?.go2rtc;
      if (!this.hass || !endpoint) {
        return {};
      }
      return {
        hass: this.hass,
        endpoint,
        proxyConfig: this.camera?.getLiveProxyConfig(),
        proxyEndpointOptions: { websocket: true },
      };
    },
    () => this._createPlayer(),
  );

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  disconnectedCallback(): void {
    this._destroyPlayer();
    super.disconnectedCallback();
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/advanced-camera-card/issues/996
    this.requestUpdate();
  }

  private _createPlayer(): void {
    const src = this._signedURLController.getValue();
    if (!src) {
      return;
    }

    this._destroyPlayer();
    this._player = new VideoRTC();
    this._player.mediaPlayerController = this._mediaPlayerController;
    this._player.microphoneStream = this.microphoneState?.stream ?? null;
    this._player.src = src;
    this._player.visibilityCheck = false;
    this._player.setControls(this.controls);

    const cameraConfig = this.camera?.getConfig();
    if (cameraConfig?.go2rtc?.modes && cameraConfig.go2rtc.modes.length) {
      this._player.mode = cameraConfig.go2rtc.modes.join(',');
    }

    this.requestUpdate();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('cameraEndpoints')) {
      // Clear old player; the new one is created by the
      // SignedURLController's valueChangeCallback once the URL resolves.
      this._destroyPlayer();
    }

    // Only treat a missing go2rtc endpoint as an error after cameraEndpoints
    // has been explicitly set (not undefined / still loading).
    const hasError =
      !!this._signedURLController.getError() ||
      (!!this.cameraEndpoints && !this.cameraEndpoints.go2rtc);
    if (hasError && !this._hasLiveError) {
      dispatchLiveErrorEvent(this);
    }
    this._hasLiveError = hasError;

    if (changedProps.has('controls') && this._player) {
      this._player.setControls(this.controls);
    }

    if (
      this._player &&
      changedProps.has('microphoneState') &&
      this._player.microphoneStream !== (this.microphoneState?.stream ?? null)
    ) {
      this._player.microphoneStream = this.microphoneState?.stream ?? null;

      // Need to force a reconnect if the microphone stream changes since
      // WebRTC cannot introduce a new stream after the offer is already made.
      this._player.reconnect();
    }
  }

  protected updated(): void {
    // Direct go2rtc websocket URLs are available synchronously from the
    // SignedURLController and do not trigger its async valueChangeCallback.
    // Ensure a player is created for those endpoints as well.
    if (!this._player && this._signedURLController.getValue()) {
      this._createPlayer();
    }
  }

  protected render(): TemplateResult | void {
    const error = this._signedURLController.getError();
    if (error) {
      return renderMessage({
        type: 'error',
        message: localize(
          error === 'proxy' ? 'error.failed_proxy' : 'error.failed_sign',
        ),
        context: this.camera?.getConfig(),
      });
    }
    if (!this.cameraEndpoints?.go2rtc) {
      return renderMessage({
        type: 'error',
        message: localize('error.live_camera_no_endpoint'),
        context: this.camera?.getConfig(),
      });
    }
    return html`${this._player}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveGo2RTCStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-go2rtc-player': VideoRTC;
    'advanced-camera-card-live-go2rtc': AdvancedCameraCardGo2RTC;
  }
}
