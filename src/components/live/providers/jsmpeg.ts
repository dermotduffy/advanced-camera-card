import JSMpeg from '@cycjimmy/jsmpeg-player';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { CameraEndpoints } from '../../../camera-manager/types.js';
import { dispatchLiveErrorEvent } from '../../../components-lib/live/utils/dispatch-live-error.js';
import { CameraConfig, CardWideConfig } from '../../../config/types.js';
import { localize } from '../../../localize/localize.js';
import liveJSMPEGStyle from '../../../scss/live-jsmpeg.scss';
import {
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
  Message,
} from '../../../types.js';
import { convertEndpointAddressToSignedWebsocket } from '../../../utils/endpoint.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
} from '../../../utils/media-info.js';
import { Timer } from '../../../utils/timer.js';
import '../../message.js';
import { renderMessage } from '../../message.js';
import '../../progress-indicator.js';
import { renderProgressIndicator } from '../../progress-indicator.js';

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

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected hass?: ExtendedHomeAssistant;

  protected _jsmpegCanvasElement?: HTMLCanvasElement;
  protected _jsmpegVideoPlayer?: JSMpeg.VideoElement;
  protected _refreshPlayerTimer = new Timer();

  @state()
  protected _message: Message | null = null;

  public async play(): Promise<void> {
    return this._jsmpegVideoPlayer?.play();
  }

  public async pause(): Promise<void> {
    this._jsmpegVideoPlayer?.stop();
  }

  public async mute(): Promise<void> {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 0;
    }
  }

  public async unmute(): Promise<void> {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 1;
    }
  }

  public isMuted(): boolean {
    return this._jsmpegVideoPlayer ? this._jsmpegVideoPlayer.player.volume === 0 : true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async seek(_seconds: number): Promise<void> {
    // JSMPEG does not support seeking.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls: boolean): Promise<void> {
    // Not implemented.
  }

  public isPaused(): boolean {
    return this._jsmpegVideoPlayer?.player?.paused ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    return this._jsmpegCanvasElement?.toDataURL('image/jpeg') ?? null;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['cameraConfig', 'cameraEndpoints'].some((prop) => changedProperties.has(prop))
    ) {
      this._message = null;
    }
  }

  /**
   * Create a JSMPEG player.
   * @param url The URL for the player to connect to.
   * @returns A JSMPEG player.
   */
  protected async _createJSMPEGPlayer(url: string): Promise<JSMpeg.VideoElement> {
    this._jsmpegVideoPlayer = await new Promise<JSMpeg.VideoElement>((resolve) => {
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

          // Necessary for screenshots.
          preserveDrawingBuffer: true,

          // Override with user-specified options.
          ...this.cameraConfig?.jsmpeg?.options,

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
              resolve(player);
            }
          },
          onPlay: () => dispatchMediaPlayEvent(this),
          onPause: () => dispatchMediaPauseEvent(this),
        },
      );
    });

    // The media loaded event must be dispatched after the player is assigned to
    // `this._jsmpegVideoPlayer`, since the load call may (will!) result in
    // calls back to the player to check for pause status for menu buttons.
    if (this._jsmpegCanvasElement) {
      dispatchMediaLoadedEvent(this, this._jsmpegCanvasElement, {
        player: this,
        capabilities: {
          supportsPause: true,
        },
        technology: ['jsmpeg'],
      });
    }
  }

  /**
   * Reset / destroy the player.
   */
  protected _resetPlayer(): void {
    this._message = null;
    this._refreshPlayerTimer.stop();
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
      this._message = {
        message: localize('error.live_camera_no_endpoint'),
        type: 'error',
        context: this.cameraConfig,
      };
      dispatchLiveErrorEvent(this);
      return;
    }

    const address = await convertEndpointAddressToSignedWebsocket(
      this.hass,
      endpoint,
      JSMPEG_URL_SIGN_EXPIRY_SECONDS,
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

    await this._createJSMPEGPlayer(address);
    this._refreshPlayerTimer.start(
      JSMPEG_URL_SIGN_EXPIRY_SECONDS - JSMPEG_URL_SIGN_REFRESH_THRESHOLD_SECONDS,
      () => this.requestUpdate(),
    );
  }

  /**
   * Master render method.
   */
  protected render(): TemplateResult | void {
    if (this._message) {
      return renderMessage(this._message);
    }

    const _render = async (): Promise<TemplateResult | void> => {
      await this._refreshPlayer();

      if (!this._jsmpegVideoPlayer || !this._jsmpegCanvasElement) {
        if (!this._message) {
          this._message = {
            message: localize('error.jsmpeg_no_player'),
            type: 'error',
            context: this.cameraConfig,
          };
          dispatchLiveErrorEvent(this);
        }
        return;
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
