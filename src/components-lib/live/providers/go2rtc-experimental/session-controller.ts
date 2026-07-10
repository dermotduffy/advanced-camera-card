import { isEqual } from 'lodash-es';

import { GO2RTC_MODES, type Go2RTCMode } from '../../../../config/schema/cameras';
import type { CardWideConfig } from '../../../../config/schema/types';
import type {
  MediaPlayerController,
  UntargetedMediaLoadedInfo,
} from '../../../../types';
import {
  addAudioTracksMuteStateListener,
  type AudioTracksMuteStateCleanup,
} from '../../../../utils/audio';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
} from '../../../../utils/controls';
import { log } from '../../../../utils/debug';
import { createMediaLoadedInfo } from '../../../../utils/media-info';
import { RetryTimer } from '../../../../utils/retry-timer';
import { convertToWebSocketURL } from '../../../../utils/websocket-url';
import type { MediaSourceFactory } from './adapters/media-source';
import type { PeerConnectionFactory } from './adapters/peer-connection';
import { OffscreenVideo, type VideoElementFactory } from './offscreen-video';
import { SignalingChannel, type WebSocketFactory } from './signaling';
import {
  createBinarySource,
  createWebRTCSource,
  type BinarySourceFactory,
  type WebRTCSourceFactory,
} from './sources/factory';
import type { MediaStreamFactory, WebRTCStreamSource } from './sources/webrtc';
import type {
  Lane,
  StreamSource,
  StreamSourceContext,
  StreamSourceFailureReason,
} from './types';
import { getPreferredSource } from './utils/source-priority';

// Preference order for modes that stream binary media over the WebSocket; the
// protocol permits only one such mode per connection, tried in this order with
// fallback (real video first w/MSE, then the poster-slideshow fallbacks).
// WebRTC is not here: it carries no WebSocket binary and runs in parallel with
// the chosen binary mode. The configured modes select membership, not order.
const BINARY_MODE_PRECEDENCE: readonly Go2RTCMode[] = ['mse', 'mp4', 'mjpeg'];

// A dropped connection is retried in place a few times, quickly, so a transient
// blip (e.g. a brief network drop on an MSE stream) heals with no full player
// remount (e.g. without the card IssueManager). After a short run of failures
// the stream is treated as down: the failure is reported upward, handing
// recovery to the card's managed retry (which shows a reconnecting indicator,
// backs off, and can give up) instead of looping here silently. The attempt cap
// keeps a persistently-failing stream from hammering the server.
const RECONNECT_INTERVAL_SECONDS = 2;
const RECONNECT_MAX_ATTEMPTS = 3;

interface Go2RTCSessionCallbacks {
  getControls: () => boolean;
  getMediaPlayerController: () => MediaPlayerController | null;
  getCardWideConfig: () => CardWideConfig | null;
  mediaLoadedCallback: (info: UntargetedMediaLoadedInfo) => void;

  // The session has exhausted its own quick reconnects and cannot recover the
  // stream; a higher level should take over (e.g. the card's media-load retry).
  // The reason is the most recent source failure, or null when there is none
  // (e.g. the socket dropped with no source having reported a cause).
  errorCallback: (reason: StreamSourceFailureReason | null) => void;
}

// Injectable platform and factory seams for tests. Every field defaults to
// the real browser implementation; production passes none of them.
interface Go2RTCSessionOptions {
  createBinarySource?: BinarySourceFactory;
  createWebRTCSource?: WebRTCSourceFactory;
  createWebSocket?: WebSocketFactory;
  createPeerConnection?: PeerConnectionFactory;
  createMediaStream?: MediaStreamFactory;
  createVideoElement?: VideoElementFactory;
  createMediaSource?: MediaSourceFactory;

  userAgent?: string;
}

// Everything belonging to one WebSocket connection attempt. Handlers capture
// this rather than reading session fields so a stale connection's events cannot
// act on a newer connection.
interface ConnectionContext {
  channel: SignalingChannel;
  url: string;
  video: HTMLVideoElement;
}

// Coordinates one go2rtc streaming session. A "binary" lane (MSE, MP4/MJPEG)
// plays on the real video with sequential fallback; a parallel WebRTC lane
// decodes into an off-screen video element and, if its stream scores
// higher, takes over the real video. The session owns the signaling channel, the
// bounded fast reconnects, and reporting loaded media.
export class Go2RTCSessionController {
  private _callbacks: Go2RTCSessionCallbacks;
  private _options: Go2RTCSessionOptions | null;

  private _channel: SignalingChannel | null = null;
  private _url: string | null = null;
  private _video: HTMLVideoElement | null = null;
  private _modes: readonly Go2RTCMode[] = GO2RTC_MODES;
  private _microphoneStream: MediaStream | null = null;

  // Binary lane.
  private _binarySource: StreamSource | null = null;

  // Queue of fallback modes not yet tried on this connection, in precedence
  // order. Starting a binary source consumes the head; teardown empties the
  // queue so no further fallback is attempted.
  private _binaryModes: Go2RTCMode[] = [];

  // WebRTC lane.
  private _webRTCSource: WebRTCStreamSource | null = null;

  // Holds the off-screen video element the WebRTC stream decodes into while the
  // WebRTC lane races a binary lane.
  private _offscreenVideo: OffscreenVideo;

  // The committed lane: the one whose media is live on the real video element
  // and has reported as loaded; null before anything loads or once the lanes
  // are torn down. Failure handling reads it to distinguish a committed (live)
  // stream dying from a losing racer being dropped.
  private _committedLane: Lane | null = null;

  // Unsubscriber for the listener on the committed WebRTC stream's audio
  // tracks. Should a WebRTC track's mute state change after load, the listener
  // sends the card a fresh media-loaded info so its audio capabilities reflect
  // the stream's current audio, not the state at load time. Null when no WebRTC
  // stream is committed; invoked and cleared on teardown and before re-arming
  // so a retired stream's listener can never fire.
  private _audioTracksMuteStateUnsubscribeCallback: AudioTracksMuteStateCleanup = null;

  // The most recent source failure on this connection, handed to the error
  // callback when the session finally gives up so the card can name the cause.
  // Null before any failure and after a healthy commit.
  private _lastFailureReason: StreamSourceFailureReason | null = null;

  private _retryTimer = new RetryTimer(RECONNECT_INTERVAL_SECONDS);

  constructor(callbacks: Go2RTCSessionCallbacks, options?: Go2RTCSessionOptions) {
    this._callbacks = callbacks;
    this._options = options ?? null;

    this._offscreenVideo = new OffscreenVideo(this._options?.createVideoElement);
  }

  // ===========================================================================
  // Public API.
  // ===========================================================================

  public connect(url: string, video: HTMLVideoElement, modes?: Go2RTCMode[]): void {
    const normalizedModes: readonly Go2RTCMode[] = modes?.length ? modes : GO2RTC_MODES;

    // Idempotent for an unchanged target so callers may invoke this on every
    // render without disturbing an established session or a pending reconnect.
    if (
      this._url === url &&
      this._video === video &&
      isEqual(this._modes, normalizedModes)
    ) {
      return;
    }

    this.reset();

    this._url = url;
    this._video = video;
    this._modes = normalizedModes;

    this._connectChannel(url, video);
  }

  public reset(): void {
    this._retryTimer.reset();
    this._lastFailureReason = null;

    this._teardownLanes();
    this._channel?.close();
    this._channel = null;

    if (this._video) {
      this._video.srcObject = null;
      this._video.src = '';

      // Clear any still frame left on the poster by an MP4/MJPEG source.
      this._video.poster = '';
    }

    this._url = null;
    this._video = null;
  }

  public setMicrophoneStream(stream: MediaStream | null): void {
    this._microphoneStream = stream;
    this._webRTCSource?.setMicrophoneStream(stream).catch(() => {});
  }

  // ===========================================================================
  // Session teardown.
  // ===========================================================================

  private _teardownLanes(): void {
    this._teardownBinaryLane();
    this._teardownWebRTCLane();
    this._committedLane = null;
  }

  // ===========================================================================
  // Signaling channel lifecycle.
  // ===========================================================================

  private _connectChannel(url: string, video: HTMLVideoElement): void {
    // The open/close callbacks reference `channel`, the very constant this
    // `new` expression is being assigned to. That is safe because the callbacks
    // fire on asynchronous WebSocket events, which cannot happen before the
    // assignment completes.
    const channel: SignalingChannel = new SignalingChannel(
      convertToWebSocketURL(url),
      {
        openCallback: () => this._handleOpen({ channel, url, video }),
        disconnectCallback: () => this._handleClose({ channel, url, video }),
      },
      { createWebSocket: this._options?.createWebSocket },
    );
    this._channel = channel;
    channel.connect();
  }

  private _handleOpen(context: ConnectionContext): void {
    this._binaryModes = BINARY_MODE_PRECEDENCE.filter((mode) =>
      this._modes.includes(mode),
    );

    // A binary lane plays directly on the real video element, so while both
    // lanes race, WebRTC decodes into a separate off-screen video element
    // (see OffscreenVideo) where its stream can be evaluated. With no
    // binary lane the real video element is available, so WebRTC attaches to it
    // directly; that also avoids decoding into an element outside the document,
    // which has been implicated in Firefox WebRTC failures. See
    // https://github.com/dermotduffy/advanced-camera-card/issues/2222
    //
    // Every configured mode is a binary mode or webrtc, and empty modes default
    // to all, so at least one lane always starts.
    //
    // Start WebRTC before the binary lane: starting a binary source can fail
    // synchronously (e.g. an unsupported codec drains the whole mode queue),
    // which would trigger a premature reconnect while no lane is live yet and
    // leave a stale WebRTC source running on a closed channel. Starting WebRTC
    // first means that reconnect check always sees a live lane.
    const hasBinaryModes = this._binaryModes.length > 0;
    if (this._modes.includes('webrtc')) {
      this._startWebRTCSource(context, hasBinaryModes);
    }
    if (hasBinaryModes) {
      this._startNextBinarySource(context);
    }
  }

  private _handleClose(context: ConnectionContext): void {
    this._teardownLanes();
    this._channel = null;
    this._reconnectOrEscalateError(context);
  }

  // ===========================================================================
  // Binary lane.
  // ===========================================================================

  private _startNextBinarySource(context: ConnectionContext): void {
    const mode = this._binaryModes.shift();
    if (!mode) {
      this._maybeReconnectIfLanesDead(context);
      return;
    }

    // The callbacks capture the source's own identity so a retired source
    // (stopped, replaced or reset) cannot act on the session. The variable is
    // declared before the factory call so callbacks fired during construction
    // see null and are ignored.
    let source: StreamSource | null = null;
    const sourceContext: StreamSourceContext = {
      video: context.video,
      channel: context.channel,
      callbacks: {
        loadedCallback: () => {
          if (source) {
            this._handleBinaryLoaded(context, source);
          }
        },
        failedCallback: (reason) => {
          if (source) {
            this._lastFailureReason = reason;
            this._logSourceFailure('binary', reason, mode);
            this._handleBinaryFailed(context, source);
          }
        },
      },
    };

    source = (this._options?.createBinarySource ?? createBinarySource)(
      mode,
      sourceContext,
      {
        createMediaSource: this._options?.createMediaSource,
        userAgent: this._options?.userAgent,
      },
    );
    if (!source) {
      this._startNextBinarySource(context);
      return;
    }

    this._binarySource = source;
    source.start();
  }

  private _handleBinaryLoaded(context: ConnectionContext, source: StreamSource): void {
    if (source !== this._binarySource) {
      return;
    }

    this._committedLane = 'binary';
    this._reportCommittedLoad(context.video, source);
  }

  private _handleBinaryFailed(context: ConnectionContext, source: StreamSource): void {
    if (source !== this._binarySource) {
      return;
    }

    source.stop();
    this._binarySource = null;

    if (this._committedLane === 'binary') {
      this._committedLane = null;
    }

    this._startNextBinarySource(context);
  }

  private _teardownBinaryLane(): void {
    // Clear the current-source identity before stopping, so any callback fired
    // synchronously by stop() fails its `!== this._binarySource` guard.
    const source = this._binarySource;
    this._binarySource = null;
    this._binaryModes = [];

    source?.stop();
  }

  // ===========================================================================
  // WebRTC lane.
  // ===========================================================================

  private _startWebRTCSource(
    context: ConnectionContext,
    useOffscreenVideo: boolean,
  ): void {
    const decodeVideo = useOffscreenVideo ? this._offscreenVideo.get() : context.video;

    let source: WebRTCStreamSource | null = null;
    const sourceContext: StreamSourceContext = {
      video: decodeVideo,
      channel: context.channel,
      callbacks: {
        loadedCallback: () => {
          if (source) {
            this._handleWebRTCLoaded(context, source, useOffscreenVideo, decodeVideo);
          }
        },
        failedCallback: (reason) => {
          if (source) {
            this._lastFailureReason = reason;
            this._logSourceFailure('webrtc', reason);
            this._handleWebRTCFailed(context, source);
          }
        },
      },
    };

    source = (this._options?.createWebRTCSource ?? createWebRTCSource)(sourceContext, {
      microphoneStream: this._microphoneStream,
      createPeerConnection: this._options?.createPeerConnection,
      createMediaStream: this._options?.createMediaStream,
    });

    this._webRTCSource = source;
    source.start();
  }

  private _handleWebRTCLoaded(
    context: ConnectionContext,
    source: WebRTCStreamSource,
    useOffscreenVideo: boolean,
    decodeVideo: HTMLVideoElement,
  ): void {
    if (source !== this._webRTCSource) {
      return;
    }

    if (!useOffscreenVideo) {
      // There is nothing in the 'binary' lane, this controller is WebRTC-only:
      // the stream already decoded on the real video element.
      this._commitWebRTC(context, source, decodeVideo);
      return;
    }

    // There is video on both the 'binary' and 'webrtc' lane -- choose a winner.
    const binary = this._binarySource;
    const winner = binary
      ? getPreferredSource(source.getStreamProfile(), binary.getStreamProfile())
      : 'webrtc';

    if (winner === 'binary') {
      // The binary source scored higher: keep it on the real video element and
      // tear down the WebRTC lane.
      this._teardownWebRTCLane();
      return;
    }

    // WebRTC wins. Tear down the binary lane first: stopping the binary source
    // clears the real video element it was playing on, so the WebRTC stream is
    // attached to that element (below) only after, never before.
    this._teardownBinaryLane();
    const stream = source.getMediaStream();
    if (stream) {
      context.video.srcObject = stream;
    }

    // Report the media-loaded frame size from the off-screen video element
    // (decodeVideo): it has been decoding this stream throughout the
    // lane-choice so it already knows the size, whereas the real video element
    // was only handed the stream on the line above and has not decoded a frame
    // yet (so it would report 0x0).
    this._commitWebRTC(context, source, decodeVideo);
    this._offscreenVideo.clear();
  }

  private _handleWebRTCFailed(
    context: ConnectionContext,
    source: WebRTCStreamSource,
  ): void {
    if (source !== this._webRTCSource) {
      return;
    }

    const wasCommitted = this._committedLane === 'webrtc';
    this._teardownWebRTCLane();

    if (wasCommitted) {
      // WebRTC was the committed (live) lane, so losing it leaves the view with
      // nothing playing: clear the real video element and force a full
      // reconnect (which restarts every configured mode, letting a binary lane
      // take over) or escalate via the error callback.
      this._committedLane = null;
      context.video.srcObject = null;

      this._closeChannelAndReconnect(context);
    } else {
      // WebRTC lost a race it was still contesting; the binary lane carries on
      // if present, otherwise reconnect.
      this._maybeReconnectIfLanesDead(context);
    }
  }

  private _commitWebRTC(
    context: ConnectionContext,
    source: WebRTCStreamSource,
    dimensionsVideo: HTMLVideoElement,
  ): void {
    this._committedLane = 'webrtc';

    // WebRTC now carries the media over the peer connection, so the socket is
    // done: signaling (offer/answer/ICE) is complete and any binary lane's
    // local consumer is torn down. go2rtc has no "stop" message, though --
    // tearing a lane down only detaches our side, so the server keeps muxing
    // that mode's binary frames down the socket (onto a now-discarded consumer)
    // until the socket itself closes. Closing it is what actually ends that
    // server stream.
    this._channel?.close();
    this._channel = null;

    this._setupAudioMuteRedispatch(context, source);
    this._reportCommittedLoad(context.video, source, dimensionsVideo);
  }

  private _setupAudioMuteRedispatch(
    context: ConnectionContext,
    source: WebRTCStreamSource,
  ): void {
    this._audioTracksMuteStateUnsubscribeCallback?.();

    // The listener is removed on teardown, so a stale source can never fire it.
    // Audio mute/unmute re-dispatches read the real video, which holds the
    // stream (and its dimensions) by the time any such change occurs.
    this._audioTracksMuteStateUnsubscribeCallback = addAudioTracksMuteStateListener(
      source.getPeerConnection(),
      () => this._dispatchMediaLoaded(context.video, source),
    );
  }

  private _teardownWebRTCLane(): void {
    // Clear the current-source identity and the audio listener before stopping,
    // so any callback fired synchronously by stop() fails its guard or is gone.
    const source = this._webRTCSource;
    this._webRTCSource = null;

    this._audioTracksMuteStateUnsubscribeCallback?.();
    this._audioTracksMuteStateUnsubscribeCallback = null;

    this._offscreenVideo.clear();

    source?.stop();
  }

  // A source in one of the lanes failed.
  private _logSourceFailure(
    lane: Lane,
    reason: StreamSourceFailureReason,
    mode?: Go2RTCMode,
  ): void {
    log(this._callbacks.getCardWideConfig(), 'go2rtc-experimental source failed', {
      lane,
      ...(mode ? { mode } : {}),
      reason,
    });
  }

  // ===========================================================================
  // Reconnect & escalation.
  // ===========================================================================

  private _maybeReconnectIfLanesDead(context: ConnectionContext): void {
    if (!this._binarySource && !this._webRTCSource && !this._binaryModes.length) {
      this._closeChannelAndReconnect(context);
    }
  }

  // Abandon this connection's channel and start the reconnect-or-escalate flow.
  private _closeChannelAndReconnect(context: ConnectionContext): void {
    context.channel.close();
    this._channel = null;

    this._reconnectOrEscalateError(context);
  }

  private _reconnectOrEscalateError(context: ConnectionContext): void {
    if (this._retryTimer.getAttempts() >= RECONNECT_MAX_ATTEMPTS) {
      this._callbacks.errorCallback(this._lastFailureReason);
      return;
    }
    this._retryTimer.schedule(() => this._connectChannel(context.url, context.video));
  }

  // ===========================================================================
  // Media-loaded reporting.
  // ===========================================================================

  // A lane just committed with live media: the connection has proven healthy, so
  // reset the fast-reconnect budget, briefly hide the controls so they do not
  // flash over the freshly loaded media, then report the load.
  private _reportCommittedLoad(
    video: HTMLVideoElement,
    source: StreamSource,
    dimensionsVideo?: HTMLVideoElement,
  ): void {
    this._retryTimer.reset();
    this._lastFailureReason = null;

    if (this._callbacks.getControls()) {
      hideMediaControlsTemporarily(video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
    }

    this._dispatchMediaLoaded(video, source, dimensionsVideo);
  }

  private _dispatchMediaLoaded(
    video: HTMLVideoElement,
    source: StreamSource,
    // Element to read the frame size from; defaults to `video`. Differs only
    // when `video` was just handed a stream and has not decoded a frame yet
    // (WebRTC committed from the off-screen video), so its size must come from
    // it.
    dimensionsVideo?: HTMLVideoElement,
  ): void {
    const mediaPlayerController = this._callbacks.getMediaPlayerController();
    const info = createMediaLoadedInfo(dimensionsVideo ?? video, {
      ...(mediaPlayerController && { mediaPlayerController }),
      capabilities: source.getCapabilities(),
      technology: source.getTechnology(),
    });
    if (info) {
      this._callbacks.mediaLoadedCallback(info);
    }
  }
}
