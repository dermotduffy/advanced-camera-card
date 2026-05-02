// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source is not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { dispatchLiveErrorEvent } from '../components-lib/live/utils/dispatch-live-error.js';
import { MediaLoadedInfoSourceController } from '../components-lib/media-loaded-info-source-controller.js';
import { VideoMediaPlayerController } from '../components-lib/media-player/video.js';
import { renderNotificationBlockFromText } from '../components/notification/block.js';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';
import { MediaPlayer, MediaPlayerController } from '../types.js';
import { mayHaveAudio } from '../utils/audio.js';
import { errorToConsole } from '../utils/basic.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
} from '../utils/controls.js';
import {
  createMediaLoadedInfo,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../utils/media-info.js';
import { ConstructableLitElement } from './types.js';

customElements.whenDefined('ha-hls-player').then(() => {
  const HaHlsPlayer = customElements.get('ha-hls-player') as ConstructableLitElement;

  @customElement('advanced-camera-card-ha-hls-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class AdvancedCameraCardHaHlsPlayer extends HaHlsPlayer implements MediaPlayer {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('#video')
    protected _video: HTMLVideoElement;

    @property({ attribute: false })
    public targetID?: string;

    private _mediaPlayerController = new VideoMediaPlayerController(
      this,
      () => this._video,
      () => this.controls,
    );

    private _mediaLoadedInfoSourceController = new MediaLoadedInfoSourceController(
      this,
      {
        getTargetID: () => this.targetID ?? null,
      },
    );

    public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
      return this._mediaPlayerController;
    }

    // =====================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-hls-player.ts
    // =====================================================================================
    protected render(): TemplateResult {
      if (this._error) {
        if (this._errorIsFatal) {
          dispatchLiveErrorEvent(this);
          return renderNotificationBlockFromText(this._error, {
            metadata: [{ text: this.entityid, icon: 'mdi:cctv' }],
          });
        } else {
          errorToConsole(this._error, console.error);
        }
      }
      return html`
        <video
          id="video"
          .poster=${this.posterUrl}
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
          @loadedmetadata=${() => {
            if (this.controls) {
              hideMediaControlsTemporarily(
                this._video,
                MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
              );
            }
          }}
          @loadeddata=${(ev) => this._loadedDataHandler(ev)}
          @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
          @play=${() => dispatchMediaPlayEvent(this)}
          @pause=${() => dispatchMediaPauseEvent(this)}
        ></video>
      `;
    }

    private _loadedDataHandler(ev: Event) {
      super._loadedData();
      const info = createMediaLoadedInfo(ev, {
        mediaPlayerController: this._mediaPlayerController,
        capabilities: {
          supportsPause: true,
          hasAudio: mayHaveAudio(this._video),
        },
        technology: ['hls'],
      });
      if (info) {
        this._mediaLoadedInfoSourceController.set(info);
      }
    }

    static get styles(): CSSResultGroup {
      return [
        super.styles,
        unsafeCSS(liveHAComponentsStyle),
        css`
          :host {
            width: 100%;
            height: 100%;
          }
          video {
            width: 100%;
            height: 100%;
          }
        `,
      ];
    }
  }
});

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-ha-hls-player': AdvancedCameraCardHaHlsPlayer;
  }
}
