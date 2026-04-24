import { Task } from '@lit-labs/task';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CameraEndpoints } from '../../../camera-manager/types.js';
import { dispatchLiveErrorEvent } from '../../../components-lib/live/utils/dispatch-live-error.js';
import { getTechnologyForVideoRTC } from '../../../components-lib/live/utils/get-technology-for-video-rtc.js';
import { VideoMediaPlayerController } from '../../../components-lib/media-player/video.js';
import { createNotificationFromText } from '../../../components-lib/notification/factory.js';
import { Notification } from '../../../config/schema/actions/types.js';
import { CameraConfig } from '../../../config/schema/cameras.js';
import { CardWideConfig } from '../../../config/schema/types.js';
import { HomeAssistant } from '../../../ha/types.js';
import { localize } from '../../../localize/localize.js';
import liveWebRTCCardStyle from '../../../scss/live-webrtc-card.scss';
import {
  AdvancedCameraCardError,
  MediaPlayer,
  MediaPlayerController,
} from '../../../types.js';
import { mayHaveAudio } from '../../../utils/audio.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  setControlsOnVideo,
} from '../../../utils/controls.js';
import { getContextFromError } from '../../../utils/error-context.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../../../utils/media-info.js';
import { renderTask } from '../../../utils/task.js';
import '../../notification/block.js';
import { renderNotificationBlock } from '../../notification/block.js';
import '../../progress-indicator.js';
import { renderProgressIndicator } from '../../progress-indicator.js';
import { VideoRTC } from './go2rtc/video-rtc.js';

// Create a wrapper for AlexxIT's WebRTC card
//  - https://github.com/AlexxIT/WebRTC
@customElement('advanced-camera-card-live-webrtc-card')
export class AdvancedCameraCardLiveWebRTCCard extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  @state()
  private _notification: Notification | null = null;

  private hass?: HomeAssistant;

  private _videoRTC: VideoRTC | null = null;

  private _mediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._getVideo(),
    () => this.controls,
  );

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  // A task to await the load of the WebRTC component.
  private _webrtcTask = new Task(this, this._getWebRTCCardElement, () => [1]);

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/advanced-camera-card/issues/996
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._videoRTC = null;
    this._notification = null;
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['cameraConfig', 'cameraEndpoints'].some((prop) => changedProperties.has(prop))
    ) {
      this._notification = null;
    }
  }

  /**
   * Get the underlying video player.
   * @returns The player or `null` if not found.
   */
  private _getVideo(): HTMLVideoElement | null {
    return this._videoRTC?.video ?? null;
  }

  private async _getWebRTCCardElement(): Promise<CustomElementConstructor | undefined> {
    await customElements.whenDefined('webrtc-camera');
    return customElements.get('webrtc-camera');
  }

  /**
   * Create the WebRTC element. May throw.
   */
  private _createWebRTC(): HTMLElement | null {
    const webrtcElement = this._webrtcTask.value;
    if (webrtcElement && this.hass && this.cameraConfig) {
      const webrtc = new webrtcElement() as HTMLElement & {
        hass: HomeAssistant;
        setConfig: (config: Record<string, unknown>) => void;
      };
      const config = {
        // By default, webrtc-card will stop the video when 50% of the video is
        // hidden. This is incompatible with the card zoom support, since the
        // video will easily stop if the user zooms in too much. Disable this
        // feature by default.
        // See: https://github.com/dermotduffy/advanced-camera-card/issues/1614
        intersection: 0,

        // Advanced Camera Card always starts muted (unlike webrtc-card).
        // See: https://github.com/dermotduffy/advanced-camera-card/issues/1654
        muted: true,

        ...this.cameraConfig.webrtc_card,
      };
      if (!config.url && !config.entity && this.cameraEndpoints?.webrtcCard) {
        config.entity = this.cameraEndpoints.webrtcCard.endpoint;
      }
      webrtc.setConfig(config);
      webrtc.hass = this.hass;
      return webrtc;
    }
    return null;
  }

  protected render(): TemplateResult | void {
    if (this._notification) {
      return renderNotificationBlock(this._notification);
    }

    const render = (): TemplateResult | void => {
      let webrtcElement: HTMLElement | null;
      try {
        webrtcElement = this._createWebRTC();
      } catch (e) {
        const context = getContextFromError(e);
        this._notification = createNotificationFromText(
          e instanceof AdvancedCameraCardError
            ? e.message
            : localize('error.webrtc_card_reported_error') + ': ' + (e as Error).message,
          {
            ...(context && { context }),
          },
        );
        dispatchLiveErrorEvent(this);
        return;
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
    return renderTask(this._webrtcTask, render, {
      inProgressFunc: () =>
        renderProgressIndicator({
          message: localize('error.webrtc_card_waiting'),
          cardWideConfig: this.cardWideConfig,
        }),
    });
  }

  public updated(): void {
    // Extract the video component after it has been rendered and generate the
    // media load event.
    this.updateComplete.then(() => {
      this._videoRTC = this.renderRoot?.querySelector('#webrtc') ?? null;
      const video = this._getVideo();
      if (video) {
        setControlsOnVideo(video, this.controls);
        video.onloadeddata = () => {
          if (this.controls) {
            hideMediaControlsTemporarily(video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
          }
          dispatchMediaLoadedEvent(this, video, {
            mediaPlayerController: this._mediaPlayerController,
            capabilities: {
              supportsPause: true,
              hasAudio: mayHaveAudio(video),
            },
            ...(this._videoRTC && {
              technology: getTechnologyForVideoRTC(this._videoRTC),
            }),
          });
        };
        video.onplay = () => dispatchMediaPlayEvent(this);
        video.onpause = () => dispatchMediaPauseEvent(this);
        video.onvolumechange = () => dispatchMediaVolumeChangeEvent(this);
      }
    });
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveWebRTCCardStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-webrtc-card': AdvancedCameraCardLiveWebRTCCard;
  }
}
