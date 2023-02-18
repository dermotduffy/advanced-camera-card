import { Task } from '@lit-labs/task';
import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localize } from '../../localize/localize.js';
import liveWebRTCCardStyle from '../../scss/live-webrtc-card.scss';
import {
  CameraConfig,
  CardWideConfig,
  FrigateCardError,
  FrigateCardMediaPlayer,
  WebRTCCardConfig,
} from '../../types.js';
import { contentsChanged } from '../../utils/basic.js';
import { dispatchMediaLoadedEvent } from '../../utils/media-info.js';
import { dispatchErrorMessageEvent, renderProgressIndicator } from '../message.js';
import { renderTask } from '../../utils/task.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
} from '../../utils/media.js';

// Create a wrapper for AlexxIT's WebRTC card
//  - https://github.com/AlexxIT/WebRTC
@customElement('frigate-card-live-webrtc-card')
export class FrigateCardLiveWebRTCCard
  extends LitElement
  implements FrigateCardMediaPlayer
{
  @property({ attribute: false, hasChanged: contentsChanged })
  public webRTCConfig?: WebRTCCardConfig;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected hass?: HomeAssistant;

  // A task to await the load of the WebRTC component.
  protected _webrtcTask = new Task(this, this._getWebRTCCardElement, () => [1]);

  public async play(): Promise<void> {
    return this._getPlayer()?.play();
  }

  public pause(): void {
    this._getPlayer()?.pause();
  }

  public mute(): void {
    const player = this._getPlayer();
    if (player) {
      player.muted = true;
    }
  }

  public unmute(): void {
    const player = this._getPlayer();
    if (player) {
      player.muted = false;
    }
  }

  public isMuted(): boolean {
    return this._getPlayer()?.muted ?? true;
  }

  public seek(seconds: number): void {
    const player = this._getPlayer();
    if (player) {
      player.currentTime = seconds;
    }
  }

  /**
   * Get the underlying video player.
   * @returns The player or `null` if not found.
   */
  protected _getPlayer(): HTMLVideoElement | null {
    return this.renderRoot?.querySelector('video') as HTMLVideoElement | null;
  }

  protected async _getWebRTCCardElement(): Promise<
    CustomElementConstructor | undefined
  > {
    await customElements.whenDefined('webrtc-camera');
    return customElements.get('webrtc-camera');
  }

  /**
   * Create the WebRTC element. May throw.
   */
  protected _createWebRTC(): HTMLElement | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webrtcElement = this._webrtcTask.value;
    if (webrtcElement && this.hass) {
      const webrtc = new webrtcElement() as HTMLElement & {
        hass: HomeAssistant;
        setConfig: (config: Record<string, unknown>) => void;
      };
      const config = { ...this.webRTCConfig };

      // If the live WebRTC configuration does not specify a URL/entity to use,
      // then take values from the camera configuration instead (if there are
      // any).
      if (!config.url) {
        config.url = this.cameraConfig?.webrtc_card?.url;
      }
      if (!config.entity) {
        config.entity = this.cameraConfig?.webrtc_card?.entity;
      }
      webrtc.setConfig(config);
      webrtc.hass = this.hass;
      return webrtc;
    }
    return null;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    const render = (): TemplateResult | void => {
      let webrtcElement: HTMLElement | null;
      try {
        webrtcElement = this._createWebRTC();
      } catch (e) {
        return dispatchErrorMessageEvent(
          this,
          e instanceof FrigateCardError
            ? e.message
            : localize('error.webrtc_card_reported_error') + ': ' + (e as Error).message,
          { context: (e as FrigateCardError).context },
        );
      }
      if (webrtcElement) {
        // Set the id to ensure that the relevant CSS styles will have
        // sufficient specifity to overcome some styles that are otherwise
        // applied to <ha-card> in Safari.
        webrtcElement.id = 'webrtc';
      }
      return html`${webrtcElement}`;
    };

    // Use a task to allow us to asynchronously wait for the WebRTC card to
    // load, but yet still have the card load be followed by the updated()
    // lifecycle callback (unlike just using `until`).
    return renderTask(this, this._webrtcTask, render, {
      inProgressFunc: () =>
        renderProgressIndicator({
          message: localize('error.webrtc_card_waiting'),
          cardWideConfig: this.cardWideConfig,
        }),
    });
  }

  /**
   * Updated lifecycle callback.
   */
  public updated(): void {
    // Extract the video component after it has been rendered and generate the
    // media load event.
    this.updateComplete.then(() => {
      const video = this._getPlayer();
      if (video) {
        const onloadeddata = video.onloadeddata;

        video.onloadeddata = (e) => {
          if (onloadeddata) {
            onloadeddata.call(video, e);
          }
          hideMediaControlsTemporarily(video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
          dispatchMediaLoadedEvent(this, video);
        };
      }
    });
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveWebRTCCardStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-webrtc-card': FrigateCardLiveWebRTCCard;
  }
}
