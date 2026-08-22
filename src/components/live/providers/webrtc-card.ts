import { Task } from '@lit/task';
import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Camera } from '../../../camera-manager/camera.js';
import { WebRTCCardController } from '../../../components-lib/live/providers/webrtc-card/controller.js';
import { dispatchLiveErrorEvent } from '../../../components-lib/live/utils/dispatch-live-error.js';
import { getTechnologyForVideoRTC } from '../../../components-lib/live/utils/get-technology-for-video-rtc.js';
import { MediaLoadedInfoSourceController } from '../../../components-lib/media-loaded-info-source-controller.js';
import { VideoMediaPlayerController } from '../../../components-lib/media-player/video.js';
import { createMediaNotification } from '../../../components-lib/notification/media.js';
import type { Notification } from '../../../config/schema/actions/types.js';
import type { CardWideConfig } from '../../../config/schema/types.js';
import type { HomeAssistant } from '../../../ha/types.js';
import { localize } from '../../../localize/localize.js';
import liveWebRTCCardStyle from '../../../scss/live-webrtc-card.scss?inline';
import type { MediaPlayer, MediaPlayerController } from '../../../types.js';
import { mayHaveAudio } from '../../../utils/audio.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  setControlsOnVideo,
} from '../../../utils/controls.js';
import {
  createMediaLoadedInfo,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../../../utils/media-info.js';
import { renderTask } from '../../../utils/task.js';

import '../../notification/block.js';

import { renderNotificationBlock } from '../../notification/block.js';

import '../../progress-indicator.js';

import { renderProgressIndicator } from '../../progress-indicator.js';
import type { VideoRTC } from './go2rtc/video-rtc.js';

// Create a wrapper for AlexxIT's WebRTC card
//  - https://github.com/AlexxIT/WebRTC
@customElement('advanced-camera-card-live-webrtc-card')
export class AdvancedCameraCardLiveWebRTCCard extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public camera?: Camera;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  // The camera's title, shown in error messages to identify the camera.
  @property({ attribute: false })
  public cameraTitle?: string;

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

  private _mediaLoadedInfoSourceController = new MediaLoadedInfoSourceController(this, {
    getTargetID: () => this.targetID ?? null,
  });

  private _webrtcCardController = new WebRTCCardController(this, {
    // The video belongs to the discarded element, so it must stop being claimed
    // -- otherwise the card would be told media is loaded during the window
    // where there is no element at all, and would keep believing it if the
    // replacement never loads.
    destroyCallback: () => this._mediaLoadedInfoSourceController.clear(),
  });

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  // A task to await the load of the WebRTC component.
  private _webrtcTask = new Task(
    this,
    () => this._webrtcCardController.awaitRegistration(),
    () => [1],
  );

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
    if (changedProperties.has('camera')) {
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

  protected render(): TemplateResult | void {
    if (this._notification) {
      return renderNotificationBlock(this._notification);
    }

    const render = (): TemplateResult | void => {
      let webrtcElement: HTMLElement | null;
      try {
        webrtcElement = this._webrtcCardController.getElement({
          camera: this.camera,
          hass: this.hass,
        });
      } catch (e) {
        this._notification = createMediaNotification({
          title: localize('error.webrtc_card_reported_error'),
          detail: e instanceof Error ? e.message : String(e),
          targetTitle: this.cameraTitle,
        });
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
    void this.updateComplete.then(() => {
      this._videoRTC = this.renderRoot?.querySelector('#webrtc') ?? null;
      const video = this._getVideo();
      if (video) {
        setControlsOnVideo(video, this.controls);
        video.onloadeddata = () => {
          if (this.controls) {
            hideMediaControlsTemporarily(video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
          }
          const info = createMediaLoadedInfo(video, {
            mediaPlayerController: this._mediaPlayerController,
            capabilities: {
              supportsPause: true,
              hasAudio: mayHaveAudio(video),
            },
            ...(this._videoRTC && {
              technology: getTechnologyForVideoRTC(this._videoRTC),
            }),
          });
          if (info) {
            this._mediaLoadedInfoSourceController.set(info);
          }
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
