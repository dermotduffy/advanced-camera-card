// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import {
  css,
  html,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { dispatchLiveErrorEvent } from '../components-lib/live/utils/dispatch-live-error.js';
import { MediaLoadedInfoSourceController } from '../components-lib/media-loaded-info-source-controller.js';
import { VideoMediaPlayerController } from '../components-lib/media-player/video.js';
import { renderMediaNotification } from '../components/notification/media.js';
import { localize } from '../localize/localize.js';
import liveHAComponentsStyle from '../scss/live-ha-components.scss?inline';
import type { MediaPlayer, MediaPlayerController } from '../types.js';
import {
  addAudioTracksMuteStateListener,
  hasAudio,
  type AudioTracksMuteStateCleanup,
} from '../utils/audio.js';
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
import type { ConstructableLitElement } from './types.js';

void customElements.whenDefined('ha-web-rtc-player').then(() => {
  const HaWebRtcPlayer = customElements.get(
    'ha-web-rtc-player',
  ) as ConstructableLitElement;

  @customElement('advanced-camera-card-ha-web-rtc-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class AdvancedCameraCardHaWebRtcPlayer extends HaWebRtcPlayer implements MediaPlayer {
    @property({ attribute: false })
    public targetID?: string;

    private _mediaPlayerController = new VideoMediaPlayerController(
      this,
      () => this._videoEl,
      () => this.controls,
    );

    private _mediaLoadedInfoSourceController = new MediaLoadedInfoSourceController(
      this,
      {
        getTargetID: () => this.targetID ?? null,
      },
    );

    protected _audioTracksMuteStateCleanup: AudioTracksMuteStateCleanup = null;

    private _lastErrored = false;

    public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
      return this._mediaPlayerController;
    }

    private async _startWebRtc(): Promise<void> {
      // There is a race condition in the underlying HA frontend code between
      // the element connection and the async start of the WebRTC session. If
      // the element is rapidly connected and disconnected, the RTC connection
      // may be left permanently "dangling" causing leaks. To reproduce (without
      // this workaround), watch the number of open connections on the go2rtc
      // UI, then edit and rapidly save a dashboard with this card -- the number
      // of open connections will not return to 1.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1992
      await super._startWebRtc();

      // Workaround: After attempting to start a WebRTC session, check if the
      // element is connected and if not then clean up correctly.
      if (!this.isConnected) {
        this._cleanUp();
      }
    }

    private _addTrack = async (event: RTCTrackEvent) => {
      if (!this._remoteStream) {
        return;
      }

      // Advanced Camera Card note: The HA frontend doesn't add audio tracks if
      // the player is muted. It does not currently respond to unmuting to
      // re-add the audio track, or perhaps assumes that situation would not
      // arise. As such, this code is kept commented out. See:
      // https://github.com/dermotduffy/advanced-camera-card/issues/2235
      // if (event.track.kind === 'audio' && this.muted) {
      //   return;
      // }

      this._remoteStream.addTrack(event.track);
      if (!this.hasUpdated) {
        await this.updateComplete;
      }
      this._videoEl.srcObject = this._remoteStream;
    };

    // =====================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-web-rtc-player.ts
    // =====================================================================================
    protected render(): TemplateResult | void {
      if (this._error) {
        return renderMediaNotification({
          title: localize('issues.media_unavailable.reasons.playback_error'),
          detail: this._error,
          targetTitle: this.entityid,
        });
      }
      return html`
        <video
          id="remote-stream"
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
          poster=${ifDefined(this.posterUrl)}
          @loadedmetadata=${() => {
            if (this.controls) {
              hideMediaControlsTemporarily(
                this._videoEl,
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

    protected updated(changedProps: PropertyValues): void {
      // A new entity is a different stream, so an earlier failure no longer
      // describes it. The restart may already have raised the new entity's
      // first failure by this point, so this must not gate on the error itself.
      if (changedProps.has('entityid')) {
        this._lastErrored = false;
      }

      super.updated(changedProps);

      // Announce each transition into failure. The error is cleared whenever
      // the stream is restarted (on reconnection, or an entity change), so a
      // player can fail more than once and every failure must be reported.
      const errored = !!this._error;
      if (errored && !this._lastErrored) {
        dispatchLiveErrorEvent(this, { detail: this._error });
      }
      this._lastErrored = errored;
    }

    private _loadedDataHandler(ev: Event) {
      super._loadedData();
      const info = createMediaLoadedInfo(ev, {
        mediaPlayerController: this._mediaPlayerController,
        capabilities: {
          supportsPause: true,
          hasAudio: hasAudio(this._videoEl, { pc: this._peerConnection }),
        },
        technology: ['webrtc'],
      });
      if (info) {
        this._mediaLoadedInfoSourceController.set(info);
      }

      // Re-report on audio track mute/unmute changes so the parent's
      // capabilities reflect the current state.
      this._audioTracksMuteStateCleanup?.();
      this._audioTracksMuteStateCleanup = addAudioTracksMuteStateListener(
        this._peerConnection,
        () => {
          const info = createMediaLoadedInfo(this._videoEl, {
            mediaPlayerController: this._mediaPlayerController,
            capabilities: {
              supportsPause: true,
              hasAudio: hasAudio(this._videoEl, { pc: this._peerConnection }),
            },
            technology: ['webrtc'],
          });
          if (info) {
            this._mediaLoadedInfoSourceController.set(info);
          }
        },
      );
    }

    private _cleanUp(): void {
      super._cleanUp();
      this._audioTracksMuteStateCleanup?.();
      this._audioTracksMuteStateCleanup = null;
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
    'advanced-camera-card-ha-web-rtc-player': AdvancedCameraCardHaWebRtcPlayer;
  }
}
