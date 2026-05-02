import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { MediaLoadedInfoSourceController } from '../components-lib/media-loaded-info-source-controller.js';
import { VideoMediaPlayerController } from '../components-lib/media-player/video';
import videoPlayerStyle from '../scss/video-player.scss';
import { MediaPlayer, MediaPlayerController, MediaPlayerElement } from '../types';
import { mayHaveAudio } from '../utils/audio';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
} from '../utils/controls';
import {
  createMediaLoadedInfo,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../utils/media-info';

@customElement('advanced-camera-card-video-player')
export class AdvancedCameraCardVideoPlayer extends LitElement implements MediaPlayer {
  @property()
  public url?: string;

  @property()
  public targetID?: string;

  @property({ type: Boolean })
  public controls = false;

  private _refVideo: Ref<MediaPlayerElement<HTMLVideoElement>> = createRef();
  private _mediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._refVideo.value ?? null,
    () => this.controls,
  );

  private _mediaLoadedInfoSourceController = new MediaLoadedInfoSourceController(this, {
    getTargetID: () => this.targetID ?? null,
  });

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  protected render(): TemplateResult | void {
    return html`
      <video
        ${ref(this._refVideo)}
        muted
        playsinline
        crossorigin="anonymous"
        ?autoplay=${false}
        ?controls=${this.controls}
        @loadedmetadata=${(ev: Event) => {
          if (ev.target && this.controls) {
            hideMediaControlsTemporarily(
              ev.target as HTMLVideoElement,
              MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
            );
          }
        }}
        @loadeddata="${(ev: Event) => {
          const info = createMediaLoadedInfo(ev, {
            ...(this._mediaPlayerController && {
              mediaPlayerController: this._mediaPlayerController,
            }),
            capabilities: {
              supportsPause: true,
              hasAudio: mayHaveAudio(ev.target as HTMLVideoElement),
            },
            technology: ['mp4'],
          });
          if (info) {
            this._mediaLoadedInfoSourceController.set(info);
          }
        }}"
        @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
        @play=${() => dispatchMediaPlayEvent(this)}
        @pause=${() => dispatchMediaPauseEvent(this)}
      >
        <source src="${ifDefined(this.url)}" type="video/mp4" />
      </video>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(videoPlayerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-video-player': AdvancedCameraCardVideoPlayer;
  }
}
