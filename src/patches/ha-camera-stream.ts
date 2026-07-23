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
import { customElement, property } from 'lit/decorators.js';

import { HA_CAMERA_STREAM_MUTE_CHANGE_EVENT } from '../components-lib/live/ha-stream-mute-controller.js';
import {
  dispatchLiveErrorEvent,
  type LiveError,
} from '../components-lib/live/utils/dispatch-live-error.js';
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

// A failure reported by one of the inner players. Its existence is the failure;
// `error` carries whatever the player knew about it. `dispatched` records
// whether it has already been announced, so a stream that fails again after
// recovering is announced again.
interface StreamError {
  error: LiveError;
  dispatched: boolean;
}

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

    // An inner player that fails renders its own error, but a hidden one is in
    // a `display: none` subtree and its failure says nothing about the stream
    // the user is watching. Errors are therefore captured per type here
    // (`stopPropagation` in `_captureInnerError`) and only re-dispatched once
    // the failing type is the visible one, which also covers HA later promoting
    // a previously-hidden stream. See:
    // https://github.com/dermotduffy/advanced-camera-card/issues/2583
    private _errorPerStream: Partial<Record<StreamType, StreamError>> = {};

    // The currently-visible stream type, refreshed in `updated()`.
    private _visibleStreamType: StreamType | null = null;

    // HA chooses between a camera's low-latency and audio-carrying streams from
    // `muted`, and never re-selects in response to the native <video> controls.
    // ACC's live view is interactive, so the mute state is owned above this
    // element, by HAStreamMuteController on `advanced-camera-card-live-ha`:
    //   - `this.muted` (which stream HA selects) and `outputMute` (the player's
    //     audio mute) are inputs from it.
    //   - this element reports the visible player's real mute back up, on any
    //     control changing it, via `HA_CAMERA_STREAM_MUTE_CHANGE_EVENT` (this
    //     is unlike HA which does not surface native-control changes itself).
    //
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2479

    // The visible player's output mute.
    @property({ attribute: false })
    public outputMute = true;

    // Report the visible player's real mute upward on any volume change (native
    // or menu control) so the controller can react.
    private _volumeChangeHandler = (): void => {
      const muted =
        this._getVisibleMediaLoadedInfo()?.mediaPlayerController?.isMuted() ?? true;
      this.dispatchEvent(
        new CustomEvent(HA_CAMERA_STREAM_MUTE_CHANGE_EVENT, {
          detail: { muted },
          bubbles: true,
          composed: true,
        }),
      );
    };

    constructor() {
      super();

      this.addEventListener(
        'advanced-camera-card:media:volumechange',
        this._volumeChangeHandler,
      );
    }

    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================

    public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
      await this.updateComplete;
      return this._getVisibleMediaLoadedInfo()?.mediaPlayerController ?? null;
    }

    // The visible stream's player info, looked up by the live stream type.
    private _getVisibleMediaLoadedInfo(): MediaLoadedInfo | null {
      return this._visibleStreamType
        ? this._mediaLoadedInfoPerStream[this._visibleStreamType] ?? null
        : null;
    }

    private _captureInnerLoad(
      stream: StreamType,
      ev: CustomEvent<MediaLoadedInfoEventDetail>,
    ) {
      // Stop the inner-player event at the aggregator boundary; the visible
      // stream's info is republished via this aggregator's own source
      // controller in updated().
      ev.stopPropagation();
      this._mediaLoadedInfoPerStream[stream] = ev.detail.info;

      // Media playing is proof this stream recovered.
      delete this._errorPerStream[stream];

      onAbort(ev.detail.signal, () => {
        if (this._mediaLoadedInfoPerStream[stream] === ev.detail.info) {
          delete this._mediaLoadedInfoPerStream[stream];
        }
      });
      this.requestUpdate();
    }

    private _captureInnerError(stream: StreamType, ev: CustomEvent<LiveError>) {
      // Stop the inner-player event at the aggregator boundary; it is
      // re-dispatched from updated() only if this stream is the visible one.
      ev.stopPropagation();
      this._errorPerStream[stream] = { error: ev.detail, dispatched: false };
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
            url=${typeof this._connected == 'undefined' || this._connected
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
          .muted=${this.outputMute}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          .targetID=${this.targetID}
          @advanced-camera-card:media:loaded=${(
            ev: CustomEvent<MediaLoadedInfoEventDetail>,
          ) => this._captureInnerLoad(STREAM_TYPE_HLS, ev)}
          @advanced-camera-card:live:error=${(ev: CustomEvent<LiveError>) =>
            this._captureInnerError(STREAM_TYPE_HLS, ev)}
          @streams=${this._handleHlsStreams}
          class="player ${stream.visible ? '' : 'hidden'}"
        ></advanced-camera-card-ha-hls-player>`;
      }

      if (stream.type === STREAM_TYPE_WEB_RTC) {
        return html`<advanced-camera-card-ha-web-rtc-player
          ?autoplay=${false}
          playsinline
          .muted=${this.outputMute}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          .targetID=${this.targetID}
          @advanced-camera-card:media:loaded=${(
            ev: CustomEvent<MediaLoadedInfoEventDetail>,
          ) => this._captureInnerLoad(STREAM_TYPE_WEB_RTC, ev)}
          @advanced-camera-card:live:error=${(ev: CustomEvent<LiveError>) =>
            this._captureInnerError(STREAM_TYPE_WEB_RTC, ev)}
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

      this._discardErrorsOnEntityChange(changedProps);
      this._dispatchVisibleStreamError();
    }

    // A different camera entity restarts the inner players from scratch (HA
    // clears their errors), so previously-recorded failures no longer describe
    // what is playing and must not suppress a fresh one.
    private _discardErrorsOnEntityChange(changedProps: PropertyValues): void {
      const previousStateObj = changedProps.get('stateObj');
      if (!previousStateObj || previousStateObj.entity_id === this.stateObj?.entity_id) {
        return;
      }
      this._errorPerStream = {};
    }

    // Surface the visible stream's failure (if any) as this element's own
    // error. The decision belongs here rather than in `_captureInnerError`
    // because the visible type is only known once `_streams()` has been
    // re-evaluated for this update.
    private _dispatchVisibleStreamError(): void {
      const stream = this._visibleStreamType;
      const streamError = stream ? this._errorPerStream[stream] : null;
      if (!streamError || streamError.dispatched) {
        return;
      }
      streamError.dispatched = true;
      dispatchLiveErrorEvent(this, streamError.error);
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
