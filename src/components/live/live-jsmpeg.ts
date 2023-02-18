import JSMpeg from '@cycjimmy/jsmpeg-player';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { renderProgressIndicator } from '../../components/message.js';
import { localize } from '../../localize/localize.js';
import liveJSMPEGStyle from '../../scss/live-jsmpeg.scss';
import {
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
  JSMPEGConfig,
} from '../../types.js';
import { dispatchMediaLoadedEvent } from '../../utils/media-info.js';
import { dispatchErrorMessageEvent } from '../message.js';
import { contentsChanged } from '../../utils/basic.js';
import { CameraEndpoints } from '../../camera-manager/types.js';
import { getEndpointAddressOrDispatchError } from '../../utils/endpoint.js';

// Number of seconds a signed URL is valid for.
const JSMPEG_URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

// Number of seconds before the expiry to trigger a refresh.
const JSMPEG_URL_SIGN_REFRESH_THRESHOLD_SECONDS = 1 * 60 * 60;

@customElement('frigate-card-live-jsmpeg')
export class FrigateCardLiveJSMPEG extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

  @property({ attribute: false, hasChanged: contentsChanged })
  public jsmpegConfig?: JSMPEGConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected hass?: ExtendedHomeAssistant;

  protected _jsmpegCanvasElement?: HTMLCanvasElement;
  protected _jsmpegVideoPlayer?: JSMpeg.VideoElement;
  protected _refreshPlayerTimerID?: number;

  public async play(): Promise<void> {
    return this._jsmpegVideoPlayer?.play();
  }

  public pause(): void {
    this._jsmpegVideoPlayer?.stop();
  }

  public mute(): void {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 0;
    }
  }

  public unmute(): void {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 1;
    }
  }

  public isMuted(): boolean {
    return this._jsmpegVideoPlayer ? this._jsmpegVideoPlayer.player.volume === 0 : true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public seek(_seconds: number): void {
    // JSMPEG does not support seeking.
  }

  /**
   * Create a JSMPEG player.
   * @param url The URL for the player to connect to.
   * @returns A JSMPEG player.
   */
  protected async _createJSMPEGPlayer(url: string): Promise<JSMpeg.VideoElement> {
    return new Promise<JSMpeg.VideoElement>((resolve) => {
      let videoDecoded = false;
      const player = new JSMpeg.VideoElement(
        this,
        url,
        {
          canvas: this._jsmpegCanvasElement,
        },
        {
          // The media carousel may automatically pause when the browser tab is
          // inactive, JSMPEG does not need to also do so independently.
          pauseWhenHidden: false,
          autoplay: false,
          protocols: [],
          audio: false,
          videoBufferSize: 1024 * 1024 * 4,

          // Override with user-specified options.
          ...this.jsmpegConfig?.options,

          // Don't allow the player to internally reconnect, as it may re-use a
          // URL with a (newly) invalid signature, e.g. during a Home Assistant
          // restart.
          reconnectInterval: 0,
          onVideoDecode: () => {
            // This is the only callback that is called after the dimensions
            // are available. It's called on every frame decode, so just
            // ignore any subsequent calls.
            if (!videoDecoded && this._jsmpegCanvasElement) {
              videoDecoded = true;
              dispatchMediaLoadedEvent(this, this._jsmpegCanvasElement);
              resolve(player);
            }
          },
        },
      );
    });
  }

  /**
   * Reset / destroy the player.
   */
  protected _resetPlayer(): void {
    if (this._refreshPlayerTimerID) {
      window.clearTimeout(this._refreshPlayerTimerID);
      this._refreshPlayerTimerID = undefined;
    }
    if (this._jsmpegVideoPlayer) {
      try {
        this._jsmpegVideoPlayer.destroy();
      } catch (err) {
        // Pass.
      }
      this._jsmpegVideoPlayer = undefined;
    }
    if (this._jsmpegCanvasElement) {
      this._jsmpegCanvasElement.remove();
      this._jsmpegCanvasElement = undefined;
    }
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (this.isConnected) {
      this.requestUpdate();
    }
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    if (!this.isConnected) {
      this._resetPlayer();
    }
    super.disconnectedCallback();
  }

  /**
   * Refresh the JSMPEG player.
   */
  protected async _refreshPlayer(): Promise<void> {
    if (!this.hass) {
      return;
    }
    this._resetPlayer();

    this._jsmpegCanvasElement = document.createElement('canvas');
    this._jsmpegCanvasElement.className = 'media';

    const endpoint = this.cameraEndpoints?.jsmpeg;
    if (!endpoint) {
      return dispatchErrorMessageEvent(this, localize('error.live_camera_no_endpoint'), {
        context: this.cameraConfig,
      });
    }

    const address = await getEndpointAddressOrDispatchError(
      this,
      this.hass,
      endpoint,
      JSMPEG_URL_SIGN_EXPIRY_SECONDS,
    );
    if (!address) {
      return;
    }

    this._jsmpegVideoPlayer = await this._createJSMPEGPlayer(address);
    this._refreshPlayerTimerID = window.setTimeout(() => {
      this.requestUpdate();
    }, (JSMPEG_URL_SIGN_EXPIRY_SECONDS - JSMPEG_URL_SIGN_REFRESH_THRESHOLD_SECONDS) * 1000);
  }

  /**
   * Master render method.
   */
  protected render(): TemplateResult | void {
    const _render = async (): Promise<TemplateResult | void> => {
      await this._refreshPlayer();

      if (!this._jsmpegVideoPlayer || !this._jsmpegCanvasElement) {
        return dispatchErrorMessageEvent(this, localize('error.jsmpeg_no_player'));
      }
      return html`${this._jsmpegCanvasElement}`;
    };
    return html`${until(
      _render(),
      renderProgressIndicator({
        cardWideConfig: this.cardWideConfig,
      }),
    )}`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveJSMPEGStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-jsmpeg': FrigateCardLiveJSMPEG;
  }
}
