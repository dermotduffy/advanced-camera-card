import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Camera } from '../../../../camera-manager/camera.js';
import { CameraEndpoints } from '../../../../camera-manager/types.js';
import { MicrophoneState } from '../../../../card-controller/types.js';
import { dispatchLiveErrorEvent } from '../../../../components-lib/live/utils/dispatch-live-error.js';
import { VideoMediaPlayerController } from '../../../../components-lib/media-player/video.js';
import { MicrophoneConfig } from '../../../../config/schema/live.js';
import { homeAssistantSignPath } from '../../../../ha/sign-path.js';
import { HomeAssistant } from '../../../../ha/types.js';
import { createProxiedEndpointIfNecessary } from '../../../../ha/web-proxy.js';
import { localize } from '../../../../localize/localize.js';
import liveGo2RTCStyle from '../../../../scss/live-go2rtc.scss';
import { MediaPlayer, MediaPlayerController, Message } from '../../../../types.js';
import { errorToConsole } from '../../../../utils/basic.js';
import { renderMessage } from '../../../message.js';
import { VideoRTC } from './video-rtc.js';

customElements.define('advanced-camera-card-live-go2rtc-player', VideoRTC);

// Note (2023-02-18): Depending on the behavior of the player / browser is
// possible this URL will need to be re-signed in order to avoid HA spamming
// logs after the expiry time, but this complexity is not added for now until
// there are verified cases of this being an issue (see equivalent in the JSMPEG
// provider).
const GO2RTC_URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

@customElement('advanced-camera-card-live-go2rtc')
export class AdvancedCameraCardGo2RTC extends LitElement implements MediaPlayer {
  // Not an reactive property to avoid resetting the video.
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

  @state()
  protected _message: Message | null = null;

  protected _player?: VideoRTC;

  protected _mediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._player?.video ?? null,
    () => this.controls,
  );

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  disconnectedCallback(): void {
    this._player = undefined;
    this._message = null;
    super.disconnectedCallback();
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/advanced-camera-card/issues/996
    this.requestUpdate();
  }

  protected _handleError(message: Message, e?: Error): void {
    if (e) {
      errorToConsole(e as Error);
    }

    this._message = {
      type: 'error',
      ...message,
    };
    dispatchLiveErrorEvent(this);
    return;
  }

  protected async _getPlayerSource(): Promise<string | null> {
    const cameraConfig = this.camera?.getConfig();
    const proxyConfig = this.camera?.getProxyConfig();
    if (!this.hass || !cameraConfig) {
      return null;
    }

    const streamEndpoint = this.cameraEndpoints?.go2rtc;
    if (!streamEndpoint) {
      this._handleError({
        message: localize('error.live_camera_no_endpoint'),
        context: cameraConfig,
      });
      return null;
    }

    let result: string | null = null;

    try {
      const endpoint = await createProxiedEndpointIfNecessary(
        this.hass,
        streamEndpoint,
        proxyConfig,
        {
          context: 'live',
          ttl: GO2RTC_URL_SIGN_EXPIRY_SECONDS,
          websocket: true,

          // The link may need to be opened multiple times.
          openLimit: 0,
        },
      );

      if (endpoint.sign) {
        result = await homeAssistantSignPath(
          this.hass,
          endpoint.endpoint,
          GO2RTC_URL_SIGN_EXPIRY_SECONDS,
        );
        if (!result) {
          this._handleError({
            message: localize('error.failed_sign'),
            context: cameraConfig,
          });
        }
      } else {
        result = endpoint.endpoint;
      }
    } catch (e) {
      this._handleError(
        {
          message: localize('error.failed_proxy'),
          context: cameraConfig,
        },
        e as Error,
      );
    }

    return result;
  }

  protected async _createPlayer(): Promise<void> {
    const src = await this._getPlayerSource();
    if (!src) {
      return;
    }

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
      this._message = null;
    }

    if (!this._message && (!this._player || changedProps.has('cameraEndpoints'))) {
      this._createPlayer();
    }

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

  protected render(): TemplateResult | void {
    if (this._message) {
      return renderMessage(this._message);
    }
    return html`${this._player}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveGo2RTCStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-go2rtc': AdvancedCameraCardGo2RTC;
  }
}
