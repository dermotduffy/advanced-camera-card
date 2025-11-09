// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, nothing, PropertyValues, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import '../components/image-player.js';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';
import { MediaLoadedInfo, MediaPlayer, MediaPlayerController } from '../types.js';
import { dispatchExistingMediaLoadedInfoAsEvent } from '../utils/media-info.js';
import './ha-hls-player.js';
import './ha-web-rtc-player.js';

customElements.whenDefined('ha-camera-stream').then(() => {
  // ========================================================================================
  // From:
  // - https://github.com/home-assistant/frontend/blob/dev/src/data/camera.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_state_name.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_object_id.ts
  // ========================================================================================
  const computeMJPEGStreamUrl = (entity: CameraEntity): string =>
    `/api/camera_proxy_stream/${entity.entity_id}?token=${entity.attributes.access_token}`;

  const STREAM_TYPE_HLS = 'hls';
  const STREAM_TYPE_WEB_RTC = 'web_rtc';
  const STREAM_TYPE_MJPEG = 'mjpeg';
  type StreamType = STREAM_TYPE_HLS | STREAM_TYPE_WEB_RTC | STREAM_TYPE_MJPEG;

  @customElement('advanced-camera-card-ha-camera-stream')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class AdvancedCameraCardHaCameraStream
    extends customElements.get('ha-camera-stream')
    implements MediaPlayer
  {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('.player:not(.hidden)')
    protected _player: MediaPlayer;

    protected _mediaLoadedInfoPerStream: Record<StreamType, MediaLoadedInfo> = {};
    protected _mediaLoadedInfoDispatched: MediaLoadedInfo | null = null;

    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================

    public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
      await this.updateComplete;
      return (await this._player?.getMediaPlayerController()) ?? null;
    }

    protected _storeMediaLoadedInfoHandler(
      stream: StreamType,
      ev: CustomEvent<MediaLoadedInfo>,
    ) {
      this._storeMediaLoadedInfo(stream, ev.detail);
      ev.stopPropagation();
    }

    protected _storeMediaLoadedInfo(
      stream: StreamType,
      mediaLoadedInfo: MediaLoadedInfo,
    ) {
      this._mediaLoadedInfoPerStream[stream] = mediaLoadedInfo;
      this.requestUpdate();
    }

    protected _renderStream(stream: Stream) {
      if (!this.stateObj) {
        return nothing;
      }
      if (stream.type === STREAM_TYPE_MJPEG) {
        return html`
          <advanced-camera-card-image-player
            @advanced-camera-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
              this._storeMediaLoadedInfo(STREAM_TYPE_MJPEG, ev.detail);
              ev.stopPropagation();
            }}
            src=${typeof this._connected == 'undefined' || this._connected
              ? computeMJPEGStreamUrl(this.stateObj)
              : this._posterUrl || ''}
            technology="mjpeg"
            class="player"
          ></advanced-camera-card-image-player>
        `;
      }

      if (stream.type === STREAM_TYPE_HLS) {
        return html` <advanced-camera-card-ha-hls-player
          ?autoplay=${false}
          playsinline
          .allowExoPlayer=${this.allowExoPlayer}
          .muted=${this.muted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          @advanced-camera-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
            this._storeMediaLoadedInfoHandler(STREAM_TYPE_HLS, ev);
            ev.stopPropagation();
          }}
          @streams=${this._handleHlsStreams}
          class="player ${stream.visible ? '' : 'hidden'}"
        ></advanced-camera-card-ha-hls-player>`;
      }

      if (stream.type === STREAM_TYPE_WEB_RTC) {
        return html`<advanced-camera-card-ha-web-rtc-player
          ?autoplay=${false}
          playsinline
          .muted=${this.muted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          @advanced-camera-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
            this._storeMediaLoadedInfoHandler(STREAM_TYPE_WEB_RTC, ev);
            ev.stopPropagation();
          }}
          @streams=${this._handleWebRtcStreams}
          class="player ${stream.visible ? '' : 'hidden'}"
        ></advanced-camera-card-ha-web-rtc-player>`;
      }

      return nothing;
    }

    public updated(changedProps: PropertyValues): void {
      super.updated(changedProps);

      const streams = this._streams(
        this._capabilities?.frontend_stream_types,
        this._hlsStreams,
        this._webRtcStreams,
        this.muted,
      );

      const visibleStream = streams.find((stream) => stream.visible) ?? null;
      if (visibleStream) {
        const mediaLoadedInfo = this._mediaLoadedInfoPerStream[visibleStream.type];
        if (mediaLoadedInfo && mediaLoadedInfo !== this._mediaLoadedInfoDispatched) {
          this._mediaLoadedInfoDispatched = mediaLoadedInfo;
          dispatchExistingMediaLoadedInfoAsEvent(this, mediaLoadedInfo);
        }
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
          img {
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
    'advanced-camera-card-ha-camera-stream': AdvancedCameraCardHaCameraStream;
  }
}
