import { isEqual } from 'lodash-es';

import { GO2RTC_MODES, type Go2RTCMode } from '../../../../config/schema/cameras';
import type { CardWideConfig } from '../../../../config/schema/types';
import type { PeerConnectionFactory } from '../../../../go2rtc/peer-connection';
import { SignalingChannel, type WebSocketFactory } from '../../../../go2rtc/signaling';
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
import { OffscreenVideo, type VideoElementFactory } from './offscreen-video';
import {
  createBinarySource,
  createWebRTCSource,
  type BinarySource,
  type BinarySourceFactory,
  type WebRTCSourceFactory,
} from './sources/factory';
import type { MediaStreamFactory, WebRTCStreamSource } from './sources/webrtc';
import type {
  Lane,
  StreamSource,
  StreamSourceContext,
  StreamSourceFailureReason,
  SurfaceKind,
  VideoStreamTarget,
} from './types';
import { getPreferredSource } from './utils/source-priority';

// Preference order for modes that stream binary media over the WebSocket; the
// protocol permits only one such mode per connection, tried in this order with
// fallback (real video first with MSE, then the MP4/MJPEG image fallbacks).
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

// The two render surfaces the session commits onto. The component owns the
// elements and the media-player controllers; the session drives which one is
// live and reports it back via surfaceCommittedCallback.
export interface VideoSurface {
  getElement(): HTMLVideoElement | null;
  getMediaPlayer(): MediaPlayerController;
}

export interface ImageSurface {
  getElement(): HTMLImageElement | null;
  getMediaPlayer(): MediaPlayerController;

  // Frames are handed over as Blobs through this callback rather than the
  // session setting `img.src` itself. The implementation (ImageSurfaceController)
  // creates each frame's object URL and revokes the previous one; the session
  // only ever holds Blobs, so it cannot leak URLs. The returned promise resolves
  // once the frame has decoded (real dimensions are then available).
  showFrame(frame: Blob): Promise<void>;
  reset(): void;
}

export interface SessionSurfaces {
  video: VideoSurface;
  image: ImageSurface;
}

interface Go2RTCSessionCallbacks {
  getControls: () => boolean;
  getCardWideConfig: () => CardWideConfig | null;
  mediaLoadedCallback: (info: UntargetedMediaLoadedInfo) => void;

  // The lane that just committed is live on this surface (the component shows
  // it and hides the other).
  surfaceCommittedCallback: (surface: SurfaceKind) => void;

  // The session has exhausted its own quick reconnects and cannot recover the
  // stream; a higher level should take over (e.g. the card's media-load retry).
  // The reason is the most recent source failure, or null when there is none
  // (e.g. the socket dropped with no source having reported a cause).
  streamErrorCallback: (reason: StreamSourceFailureReason | null) => void;
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

// One WebSocket connection attempt: its channel and URL, plus a reference to
// the render surfaces to draw onto (the surfaces outlive any single attempt).
// Handlers capture this rather than reading session fields so a stale
// connection's events cannot act on a newer connection.
interface ConnectionContext {
  channel: SignalingChannel;
  url: string;
  surfaces: SessionSurfaces;
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
  private _surfaces: SessionSurfaces | null = null;
  private _modes: readonly Go2RTCMode[] = GO2RTC_MODES;

  // Binary lane: the active source paired with the surface it renders on (mse
  // -> video, MP4/MJPEG -> image). Kept as one unit because the factory returns
  // them together and they are read together when the source commits. Null when
  // no binary source is running.
  private _binary: BinarySource | null = null;

  // Queue of fallback modes not yet tried on this connection, in precedence
  // order. Starting a binary source consumes the head; teardown empties the
  // queue so no further fallback is attempted.
  private _binaryModes: Go2RTCMode[] = [];

  // WebRTC lane.
  private _webRTCSource: WebRTCStreamSource | null = null;

  // Holds the off-screen video element the WebRTC stream decodes into while the
  // WebRTC lane races a binary lane.
  private _offscreenVideo: OffscreenVideo;

  // The committed lane: the one whose media is live (on the video or image
  // surface) and has reported as loaded; null before anything loads or once the
  // lanes are torn down. Failure handling reads it to distinguish a committed
  // (live) stream dying from a losing racer being dropped.
  private _committedLane: Lane | null = null;

  // The surface currently showing committed media; null before anything commits
  // or once torn down. On a surface switch (e.g. MSE falls back to MP4, or a
  // WebRTC win over an MJPEG image) the outgoing surface is reset.
  private _committedSurface: SurfaceKind | null = null;

  // The source whose media is committed; null before anything commits or once
  // torn down. A source can re-report loaded (e.g. a <video> re-fires
  // loadeddata on a mid-stream resolution change), so this distinguishes a
  // fresh commit from a repeated load.
  private _committedSource: StreamSource | null = null;

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
  private _lastStreamFailureReason: StreamSourceFailureReason | null = null;

  private _retryTimer = new RetryTimer(RECONNECT_INTERVAL_SECONDS);

  constructor(callbacks: Go2RTCSessionCallbacks, options?: Go2RTCSessionOptions) {
    this._callbacks = callbacks;
    this._options = options ?? null;

    this._offscreenVideo = new OffscreenVideo(this._options?.createVideoElement);
  }

  // ===========================================================================
  // Public API.
  // ===========================================================================

  // The `surfaces` object identifies the session target: the same object means
  // "keep the established session" (so callers may invoke this on every render),
  // a new object means "reset and reconnect". Callers must therefore hold one
  // stable surfaces object for as long as the target is unchanged, and hand over
  // a fresh one (or `reset()` first) if they ever remount the underlying
  // elements.
  public connect(
    url: string,
    surfaces: SessionSurfaces,
    modes?: readonly Go2RTCMode[],
  ): void {
    const normalizedModes: readonly Go2RTCMode[] = modes?.length ? modes : GO2RTC_MODES;

    if (
      this._url === url &&
      this._surfaces === surfaces &&
      isEqual(this._modes, normalizedModes)
    ) {
      return;
    }

    this.reset();

    this._url = url;
    this._surfaces = surfaces;
    this._modes = normalizedModes;

    this._connectChannel(url, surfaces);
  }

  public reset(): void {
    this._retryTimer.reset();
    this._lastStreamFailureReason = null;

    this._teardownLanes();
    this._channel?.close();
    this._channel = null;

    const video = this._surfaces?.video.getElement();
    if (video) {
      video.srcObject = null;
      video.src = '';
    }
    this._surfaces?.image.reset();

    this._url = null;
    this._surfaces = null;
  }

  // ===========================================================================
  // Session teardown.
  // ===========================================================================

  private _teardownLanes(): void {
    this._teardownBinaryLane();
    this._teardownWebRTCLane();
    this._committedLane = null;
    this._committedSurface = null;
    this._committedSource = null;
  }

  // ===========================================================================
  // Signaling channel lifecycle.
  // ===========================================================================

  private _connectChannel(url: string, surfaces: SessionSurfaces): void {
    // The open/close callbacks reference `channel`, the very constant this
    // `new` expression is being assigned to. That is safe because the callbacks
    // fire on asynchronous WebSocket events, which cannot happen before the
    // assignment completes.
    const channel: SignalingChannel = new SignalingChannel(
      convertToWebSocketURL(url),
      {
        openCallback: () => this._handleOpen({ channel, url, surfaces }),
        disconnectCallback: () => this._handleClose({ channel, url, surfaces }),
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

    // While a binary lane races, WebRTC decodes into a separate off-screen video
    // element (see OffscreenVideo) where its stream can be evaluated without
    // contending for the real <video> that an MSE binary lane plays on. With no
    // binary lane the real video element is free, so WebRTC attaches to it
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

    // No element to render onto (the surface was detached); abandon the lane.
    const video = context.surfaces.video.getElement();
    if (!video) {
      return;
    }

    // The callbacks capture the source's own identity so a retired source
    // (stopped, replaced or reset) cannot act on the session. The variable is
    // declared before the factory call so callbacks fired during construction
    // see null and are ignored.
    let source: StreamSource | null = null;

    const binarySource = (this._options?.createBinarySource ?? createBinarySource)(
      mode,
      {
        video: { kind: 'video', video },
        image: {
          kind: 'image',
          showFrame: (frame) => context.surfaces.image.showFrame(frame),
        },
      },
      context.channel,
      {
        loadedCallback: () => {
          if (source) {
            this._handleBinaryLoaded(context, source);
          }
        },
        failedCallback: (reason: StreamSourceFailureReason) => {
          if (source) {
            this._lastStreamFailureReason = reason;
            this._logSourceFailure('binary', reason, mode);
            this._handleBinaryFailed(context, source);
          }
        },
      },
      {
        createMediaSource: this._options?.createMediaSource,
        userAgent: this._options?.userAgent,
      },
    );
    if (!binarySource) {
      this._startNextBinarySource(context);
      return;
    }

    source = binarySource.source;
    this._binary = binarySource;
    source.start();
  }

  private _handleBinaryLoaded(context: ConnectionContext, source: StreamSource): void {
    const binary = this._binary;
    if (!binary || source !== binary.source) {
      return;
    }

    this._committedLane = 'binary';
    this._reportCommittedLoad(context, binary.surface, source);
  }

  private _handleBinaryFailed(context: ConnectionContext, source: StreamSource): void {
    if (source !== this._binary?.source) {
      return;
    }

    source.stop();
    this._binary = null;

    if (this._committedLane === 'binary') {
      this._committedLane = null;
    }

    this._startNextBinarySource(context);
  }

  private _teardownBinaryLane(): void {
    // Clear the current-source identity before stopping, so any callback fired
    // synchronously by stop() fails its `!== this._binary?.source` guard.
    const source = this._binary?.source;
    this._binary = null;
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
    // While racing a binary lane, decode into the off-screen element; otherwise
    // decode straight onto the real video (absent it, there is nothing to do).
    let decodeVideo: HTMLVideoElement;
    if (useOffscreenVideo) {
      decodeVideo = this._offscreenVideo.get();
    } else {
      const video = context.surfaces.video.getElement();
      if (!video) {
        return;
      }
      decodeVideo = video;
    }

    let source: WebRTCStreamSource | null = null;
    const sourceContext: StreamSourceContext<VideoStreamTarget> = {
      target: { kind: 'video', video: decodeVideo },
      channel: context.channel,
      callbacks: {
        loadedCallback: () => {
          if (source) {
            this._handleWebRTCLoaded(context, source, useOffscreenVideo, decodeVideo);
          }
        },
        failedCallback: (reason) => {
          if (source) {
            this._lastStreamFailureReason = reason;
            this._logSourceFailure('webrtc', reason);
            this._handleWebRTCFailed(context, source);
          }
        },
      },
    };

    source = (this._options?.createWebRTCSource ?? createWebRTCSource)(sourceContext, {
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
    const binary = this._binary?.source ?? null;
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
    const video = context.surfaces.video.getElement();
    if (video && stream) {
      video.srcObject = stream;
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
      const video = context.surfaces.video.getElement();
      if (video) {
        video.srcObject = null;
      }

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
    this._reportCommittedLoad(context, 'video', source, dimensionsVideo);
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
      () => this._dispatchMediaLoaded(context, 'video', source),
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
    if (!this._binary && !this._webRTCSource && !this._binaryModes.length) {
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
      this._callbacks.streamErrorCallback(this._lastStreamFailureReason);
      return;
    }
    this._retryTimer.schedule(() => this._connectChannel(context.url, context.surfaces));
  }

  // ===========================================================================
  // Media-loaded reporting.
  // ===========================================================================

  // A lane just committed with live media: the connection has proven healthy, so
  // reset the fast-reconnect budget, hand the newly live surface to the
  // component (resetting the one being left behind), briefly hide the video
  // controls so they do not flash over the freshly loaded media, then report the
  // load with the committed surface's controller.
  private _reportCommittedLoad(
    context: ConnectionContext,
    surface: SurfaceKind,
    source: StreamSource,
    dimensionsVideo?: HTMLVideoElement,
  ): void {
    if (source === this._committedSource) {
      // The same source re-reporting (e.g. a mid-stream resolution change
      // re-fires the video's loadeddata): the surface and controls are already
      // set up, so only refresh the reported media dimensions. Re-running the
      // control hide would leak its loadstart listener on each repeat.
      this._dispatchMediaLoaded(context, surface, source, dimensionsVideo);
      return;
    }
    this._committedSource = source;

    this._retryTimer.reset();
    this._lastStreamFailureReason = null;

    if (this._committedSurface && this._committedSurface !== surface) {
      this._resetSurface(context, this._committedSurface);
    }
    this._committedSurface = surface;
    this._callbacks.surfaceCommittedCallback(surface);

    const video = context.surfaces.video.getElement();

    if (surface === 'video' && this._callbacks.getControls() && video) {
      hideMediaControlsTemporarily(video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
    }

    this._dispatchMediaLoaded(context, surface, source, dimensionsVideo);
  }

  private _resetSurface(context: ConnectionContext, surface: SurfaceKind): void {
    if (surface === 'image') {
      context.surfaces.image.reset();
      return;
    }
    const video = context.surfaces.video.getElement();
    if (video) {
      video.srcObject = null;
      video.src = '';
    }
  }

  private _dispatchMediaLoaded(
    context: ConnectionContext,
    surface: SurfaceKind,
    source: StreamSource,
    // Element to read the frame size from; used only for the video surface and
    // defaults to the video-surface element. Differs when that element was just
    // handed a stream and has not decoded a frame yet (WebRTC committed from the
    // off-screen video), so its size must come from that off-screen element.
    dimensionsVideo?: HTMLVideoElement,
  ): void {
    const targetSurface =
      surface === 'video' ? context.surfaces.video : context.surfaces.image;
    const dimensionsElement =
      surface === 'video'
        ? dimensionsVideo ?? context.surfaces.video.getElement()
        : context.surfaces.image.getElement();
    if (!dimensionsElement) {
      return;
    }

    const info = createMediaLoadedInfo(dimensionsElement, {
      mediaPlayerController: targetSurface.getMediaPlayer(),
      capabilities: source.getCapabilities(),
      technology: source.getTechnology(),
    });
    if (info) {
      this._callbacks.mediaLoadedCallback(info);
    }
  }
}
