import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CameraEndpoints } from '../../../../camera-manager/types.js';
import { MicrophoneState } from '../../../../card-controller/types.js';
import { dispatchLiveErrorEvent } from '../../../../components-lib/live/utils/dispatch-live-error.js';
import { VideoMediaPlayerController } from '../../../../components-lib/media-player/video.js';
import { CameraConfig, MicrophoneConfig } from '../../../../config/types.js';
import { localize } from '../../../../localize/localize.js';
import liveGo2RTCStyle from '../../../../scss/live-go2rtc.scss';
import {
  ExtendedHomeAssistant,
  MediaPlayer,
  MediaPlayerController,
  Message,
} from '../../../../types.js';
import { convertEndpointAddressToSignedWebsocket } from '../../../../utils/endpoint.js';
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
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

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
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/advanced-camera-card/issues/996
    this.requestUpdate();
  }

  protected async _createPlayer(): Promise<void> {
    if (!this.hass) {
      return;
    }

    const endpoint = this.cameraEndpoints?.go2rtc;
    if (!endpoint) {
      this._message = {
        type: 'error',
        message: localize('error.live_camera_no_endpoint'),
        context: this.cameraConfig,
      };
      dispatchLiveErrorEvent(this);
      return;
    }

    const address = await convertEndpointAddressToSignedWebsocket(
      this.hass,
      endpoint,
      GO2RTC_URL_SIGN_EXPIRY_SECONDS,
    );
    if (!address) {
      this._message = {
        type: 'error',
        message: localize('error.failed_sign'),
        context: this.cameraConfig,
      };
      dispatchLiveErrorEvent(this);
      return;
    }

    this._player = new VideoRTC();
    this._player.mediaPlayerController = this._mediaPlayerController;
    this._player.microphoneStream = this.microphoneState?.stream ?? null;
    this._player.src = address;
    this._player.visibilityCheck = false;
    this._player.setControls(this.controls);

    if (this.cameraConfig?.go2rtc?.modes && this.cameraConfig.go2rtc.modes.length) {
      this._player.mode = this.cameraConfig.go2rtc.modes.join(',');
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
