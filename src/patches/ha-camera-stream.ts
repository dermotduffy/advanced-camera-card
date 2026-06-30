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
  nothing,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { MediaLoadedInfoSourceController } from '../components-lib/media-loaded-info-source-controller.js';

import '../components/image-player.js';

import liveHAComponentsStyle from '../scss/live-ha-components.scss';
import type {
  MediaLoadedInfo,
  MediaLoadedInfoEventDetail,
  MediaPlayer,
  MediaPlayerController,
} from '../types.js';
import { onAbort } from '../utils/abort-signal.js';

import './ha-hls-player.js';
import './ha-web-rtc-player.js';

void customElements.whenDefined('ha-camera-stream').then(() => {
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
    @property({ attribute: false })
    public targetID?: string;

    // ha-camera-stream renders up to three inner players (MJPEG / HLS /
    // WebRTC), only one visible. Inner leaves all fire `media:loaded`
    // independently -- we suppress those at this boundary (`stopPropagation` in
    // `_captureInnerLoad`), cache the latest per type, and republish the
    // visible one's info via our own source controller in `updated()`.
    private _mediaLoadedInfoPerStream: Record<StreamType, MediaLoadedInfo> = {};
    private _mediaLoadedInfoSourceController = new MediaLoadedInfoSourceController(
      this,
      {
        getTargetID: () => this.targetID ?? null,
      },
    );

    // The currently-visible stream type, refreshed in `updated()`.
    private _visibleStreamType: StreamType | null = null;

    // -------- Audio / stream selection model (hacking around HA!) --------
    //
    // The HA frontend chooses between a camera's streams (e.g. low-latency
    // WebRTC vs higher-latency HLS) from `muted`: when unmuted it switches to a
    // stream that carries audio if the chosen one has none. HA sets `muted`
    // statically per context (i.e. a stock card sets it once); the native
    // <video> controls only toggle the video element's output -- so HA never
    // re-selects in response to native video controls
    //
    // ACC's live view is interactive, with both external audio controls (i.e.
    // menu buttons) and native video audio controls, so it must split the two
    // roles HA conflates in the single `muted` variable:
    //   - `this.muted` is a one-way stream-selection latch (as defined in the
    //     HA frontend code that this builds on). It starts `true` (low-latency
    //     WebRTC) and flips to `false` the first time the visible stream is
    //     unmuted by any control, switching to the audio-capable stream (if
    //     necessary). It never flips back, so a muted view keeps low latency
    //     and an autoplay force-mute cannot downgrade the stream.
    //   - `_outputMuted` is the stream's actual output mute state, mirrored
    //     from the stream's `volumechange` event. The stream players bind to
    //     this (not the latch), so a remount (e.g. lazy reload) restores the
    //     real mute instead of the latch value -- otherwise a muted view could
    //     return unmuted.
    //
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2479
    // ----------------------------------------------------------------------

    // The stream's true muted state.
    @state()
    private _streamMuted = true;

    // On any stream volume change: mirror it into `_streamMuted` (so a remount
    // of an element can restore it), and latch `muted` to false the first time
    // the stream becomes unmuted (switching to the audio-capable stream).
    // Muting is never latched, i.e. unmuting can cause a stream switch, but
    // muting cannot.
    private _streamVolumeChangeHandler = (): void => {
      const leafMuted =
        this._getVisibleMediaLoadedInfo()?.mediaPlayerController?.isMuted() ?? true;
      this._streamMuted = leafMuted;

      if (this.muted && !leafMuted) {
        this.muted = false;
      }
    };

    constructor() {
      super();

      // Start muted: low-latency WebRTC (HaCameraStream defaults `muted` false,
      // in ACC unmute is controlled by user-specified policy.
      this.muted = true;

      this.addEventListener(
        'advanced-camera-card:media:volumechange',
        this._streamVolumeChangeHandler,
      );
    }

    public willUpdate(changedProps: PropertyValues): void {
      super.willUpdate(changedProps);

      // A new camera (entity) on a reused element must not inherit the previous
      // camera's audio latch -- start muted on the low-latency stream again.
      const previousStateObj = changedProps.get('stateObj');
      if (previousStateObj && previousStateObj.entity_id !== this.stateObj?.entity_id) {
        this.muted = true;
        this._streamMuted = true;
      }
    }

    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================

    public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
      await this.updateComplete;
      return this._getVisibleMediaLoadedInfo()?.mediaPlayerController ?? null;
    }

    // The visible stream's leaf info, looked up by the live stream type.
    private _getVisibleMediaLoadedInfo(): MediaLoadedInfo | null {
      return this._visibleStreamType
        ? this._mediaLoadedInfoPerStream[this._visibleStreamType] ?? null
        : null;
    }

    private _captureInnerLoad(
      stream: StreamType,
      ev: CustomEvent<MediaLoadedInfoEventDetail>,
    ) {
      // Stop the inner-leaf event at the aggregator boundary; the visible
      // stream's info is republished via this aggregator's own source
      // controller in updated().
      ev.stopPropagation();
      this._mediaLoadedInfoPerStream[stream] = ev.detail.info;
      onAbort(ev.detail.signal, () => {
        if (this._mediaLoadedInfoPerStream[stream] === ev.detail.info) {
          delete this._mediaLoadedInfoPerStream[stream];
        }
      });
      this.requestUpdate();
    }

    protected _renderStream(stream: Stream) {
      if (!this.stateObj) {
        return nothing;
      }
      if (stream.type === STREAM_TYPE_MJPEG) {
        return html`
          <advanced-camera-card-image-player
            .targetID=${this.targetID}
            @advanced-camera-card:media:loaded=${(
              ev: CustomEvent<MediaLoadedInfoEventDetail>,
            ) => this._captureInnerLoad(STREAM_TYPE_MJPEG, ev)}
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
          .muted=${this._streamMuted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          .targetID=${this.targetID}
          @advanced-camera-card:media:loaded=${(
            ev: CustomEvent<MediaLoadedInfoEventDetail>,
          ) => this._captureInnerLoad(STREAM_TYPE_HLS, ev)}
          @streams=${this._handleHlsStreams}
          class="player ${stream.visible ? '' : 'hidden'}"
        ></advanced-camera-card-ha-hls-player>`;
      }

      if (stream.type === STREAM_TYPE_WEB_RTC) {
        return html`<advanced-camera-card-ha-web-rtc-player
          ?autoplay=${false}
          playsinline
          .muted=${this._streamMuted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          .targetID=${this.targetID}
          @advanced-camera-card:media:loaded=${(
            ev: CustomEvent<MediaLoadedInfoEventDetail>,
          ) => this._captureInnerLoad(STREAM_TYPE_WEB_RTC, ev)}
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
      this._visibleStreamType = visibleStream?.type ?? null;

      // Republish the visible stream's cached info as our own, overriding only
      // `hasAudio` (see below).
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/2479
      const visibleMediaLoadedInfo = this._getVisibleMediaLoadedInfo();
      if (visibleMediaLoadedInfo) {
        this._mediaLoadedInfoSourceController.set({
          ...visibleMediaLoadedInfo,
          capabilities: {
            ...visibleMediaLoadedInfo.capabilities,

            // `hasAudio` here means "audio is available" -- keep the unmute
            // control available whenever any candidate stream has audio, even
            // if the visible (muted, possibly audio-less) one does not, since
            // with the 'ha' provider unmuting actually switches to the stream
            // that has it.
            hasAudio:
              visibleMediaLoadedInfo.capabilities?.hasAudio ||
              !!this._hlsStreams?.hasAudio ||
              !!this._webRtcStreams?.hasAudio,
          },
        });
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
