import type {
  MediaLoadedCapabilities,
  MediaTechnology,
  UnsubscribeCallback,
} from '../../../../../types';
import { hasAudio } from '../../../../../utils/audio';
import { Timer } from '../../../../../utils/timer';
import {
  createBrowserMediaSource,
  type MediaSourceFactory,
  type MediaSourceInterface,
} from '../adapters/media-source';
import type {
  Go2RTCMessage,
  StreamProfile,
  StreamSource,
  StreamSourceContext,
  VideoStreamTarget,
} from '../types';
import { BoundedBufferQueue } from '../utils/bounded-buffer-queue';
import {
  convertToCodecString,
  getCodecsForUserAgent,
  selectSupportedCodecs,
} from '../utils/codecs';
import { LiveEdgeTracker } from '../utils/live-edge-tracker';
import type { LiveEdgeAction } from '../utils/live-edge-tracker/types';
import { isServerErrorForMode } from '../utils/messages';
import { isWebKitUserAgent } from '../utils/user-agent';

// ===========================================================================
// MSE Tuning
// ===========================================================================

// These are judgement-based budgets (time, buffered seconds, staged bytes)
// balancing latency and resilience, not derived values. The retained-buffer
// window and the staged-bytes cap follow go2rtc's reference web client; the
// negotiation timeout has no counterpart there and is added by this
// implementation.

// Seconds of media retained behind the live edge; older media is trimmed. This
// bounds memory even across a long pause (the buffer never grows past this
// window), so a paused stream can hold its frame indefinitely.
const RETAINED_BUFFER_SECONDS = 15;

// On resume, if the playhead is more than this far behind the live edge, jump
// forward to rejoin live rather than replaying the buffered-behind media.
const LIVE_EDGE_RESUME_LAG_SECONDS = 1;

// Where a live-edge jump lands, as a gap behind the buffered end (a small
// cushion so playback does not immediately starve at the very edge).
const LIVE_EDGE_JUMP_OFFSET_SECONDS = 0.75;

// Bound on media staged while the SourceBuffer is busy; a stream that outruns
// this is unrecoverable without a reconnect.
const MAX_PENDING_BUFFER_BYTES = 2 * 1024 * 1024;

// How long to wait for the server's codec reply before failing the source.
const MSE_NEGOTIATION_TIMEOUT_SECONDS = 5;

// ===========================================================================
// MSEStreamSource
// ===========================================================================

interface MSEStreamSourceOptions {
  createMediaSource?: MediaSourceFactory;
  userAgent?: string;
}

export class MSEStreamSource implements StreamSource {
  private _context: StreamSourceContext<VideoStreamTarget>;

  private _createMediaSource: MediaSourceFactory;
  private _mediaSource: MediaSourceInterface | null = null;

  private _sourceBuffer: SourceBuffer | null = null;
  private _pendingBuffer = new BoundedBufferQueue(MAX_PENDING_BUFFER_BYTES);

  // The codec string the server settled on during negotiation; null until then.
  private _codecs: string | null = null;

  // The codecs offered to the server, derived once from the user agent.
  private _codecCandidates: readonly string[];

  private _negotiationTimer = new Timer();
  private _liveEdge: LiveEdgeTracker;

  private _unsubscribeCallbacks: UnsubscribeCallback[] = [];

  private _loadedHandler = (): void => {
    this._context.callbacks.loadedCallback();
  };

  private _errorHandler = (): void => {
    this._context.callbacks.failedCallback('media_error');
  };

  // On resume, rejoin the very live edge.
  private _playHandler = (): void => {
    const sourceBuffer = this._sourceBuffer;
    if (!sourceBuffer?.buffered.length) {
      return;
    }
    const video = this._context.target.video;
    const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
    if (end - video.currentTime > LIVE_EDGE_RESUME_LAG_SECONDS) {
      video.currentTime = end - LIVE_EDGE_JUMP_OFFSET_SECONDS;
    }
  };

  constructor(
    context: StreamSourceContext<VideoStreamTarget>,
    options?: MSEStreamSourceOptions,
  ) {
    this._context = context;
    this._createMediaSource = options?.createMediaSource ?? createBrowserMediaSource;

    const userAgent = options?.userAgent ?? navigator.userAgent;
    this._liveEdge = new LiveEdgeTracker({ webkit: isWebKitUserAgent(userAgent) });
    this._codecCandidates = getCodecsForUserAgent(userAgent);
  }

  public start(): void {
    const mediaSource = this._createMediaSource();
    if (!mediaSource) {
      this._context.callbacks.failedCallback('unsupported');
      return;
    }
    this._mediaSource = mediaSource;

    this._unsubscribeCallbacks.push(
      mediaSource.subscribeToSourceOpen(() => this._negotiate(mediaSource)),
      this._context.channel.subscribeToMessages((message) =>
        this._handleMessage(mediaSource, message),
      ),
    );
    this._context.target.video.addEventListener('loadeddata', this._loadedHandler);
    this._context.target.video.addEventListener('error', this._errorHandler);
    this._context.target.video.addEventListener('play', this._playHandler);

    mediaSource.attach(this._context.target.video);
  }

  public stop(): void {
    this._negotiationTimer.stop();

    this._unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this._unsubscribeCallbacks = [];

    this._context.target.video.removeEventListener('loadeddata', this._loadedHandler);
    this._context.target.video.removeEventListener('error', this._errorHandler);
    this._context.target.video.removeEventListener('play', this._playHandler);

    this._context.channel.setBinaryCallback(null);

    this._mediaSource?.detach(this._context.target.video);
    this._mediaSource = null;

    this._sourceBuffer = null;

    this._pendingBuffer.clear();
  }

  public getCapabilities(): MediaLoadedCapabilities {
    return {
      supportsPause: true,
      hasAudio: hasAudio(this._context.target.video, { mseCodecs: this._codecs }),
      has2WayAudio: false,
    };
  }

  public getTechnology(): MediaTechnology[] {
    return ['mse'];
  }

  public getStreamProfile(): StreamProfile {
    const codecs = this._codecs ?? '';
    return {
      hasVideo: codecs.includes('avc1') || codecs.includes('hvc1'),
      hasH265Video: codecs.includes('hvc1'),
      hasAudio:
        codecs.includes('mp4a') || codecs.includes('opus') || codecs.includes('flac'),
      hasAACAudio: codecs.includes('mp4a'),
    };
  }

  private _negotiate(mediaSource: MediaSourceInterface): void {
    const codecs = selectSupportedCodecs(
      this._codecCandidates,
      { audio: true, video: true },
      (mimeType) => mediaSource.isTypeSupported(mimeType),
    );

    this._context.channel.send({ type: 'mse', value: convertToCodecString(codecs) });
    this._negotiationTimer.start(MSE_NEGOTIATION_TIMEOUT_SECONDS, () =>
      this._context.callbacks.failedCallback('negotiation_timeout'),
    );
  }

  private _handleMessage(
    mediaSource: MediaSourceInterface,
    message: Go2RTCMessage,
  ): void {
    if (isServerErrorForMode(message, 'mse')) {
      this._negotiationTimer.stop();
      this._context.callbacks.failedCallback('server_error');
      return;
    }

    if (
      message.type !== 'mse' ||
      typeof message.value !== 'string' ||
      this._sourceBuffer
    ) {
      return;
    }

    this._negotiationTimer.stop();

    // go2rtc answers the codec offer with an `mse` text message whose value is
    // the codec string for addSourceBuffer. It arrives once, before any
    // SourceBuffer exists (the guard above returns for every later message), so
    // this value is the negotiated codecs.
    this._codecs = message.value;

    let sourceBuffer: SourceBuffer;
    try {
      sourceBuffer = mediaSource.addSourceBuffer(message.value);
    } catch {
      this._context.callbacks.failedCallback('media_error');
      return;
    }

    // Segments mode: order media by its fMP4 timestamps rather than by
    // arrival order.
    sourceBuffer.mode = 'segments';

    const updateEndListener = (): void =>
      this._handleUpdateEnd(mediaSource, sourceBuffer);
    sourceBuffer.addEventListener('updateend', updateEndListener);
    this._unsubscribeCallbacks.push(() =>
      sourceBuffer.removeEventListener('updateend', updateEndListener),
    );

    this._sourceBuffer = sourceBuffer;

    this._context.channel.setBinaryCallback((data) =>
      this._handleData(sourceBuffer, data),
    );
  }

  private _handleData(sourceBuffer: SourceBuffer, data: ArrayBuffer): void {
    if (sourceBuffer.updating || !this._pendingBuffer.isEmpty) {
      if (!this._pendingBuffer.push(data)) {
        this._context.callbacks.failedCallback('buffer_overflow');
      }
      return;
    }

    this._append(sourceBuffer, data);
  }

  private _append(sourceBuffer: SourceBuffer, data: ArrayBuffer): void {
    try {
      sourceBuffer.appendBuffer(data);
    } catch {
      // Append failures during teardown races are recoverable by later appends;
      // fatal conditions surface through the video element's error event
      // instead.
    }
  }

  private _handleUpdateEnd(
    mediaSource: MediaSourceInterface,
    sourceBuffer: SourceBuffer,
  ): void {
    if (sourceBuffer.updating) {
      return;
    }

    // A queued updateend can fire after a reconnect or teardown has closed the
    // MediaSource (detached from the video).
    if (!mediaSource.isOpen()) {
      return;
    }

    const pending = this._pendingBuffer.shift();
    if (pending) {
      this._append(sourceBuffer, pending);
      return;
    }

    if (!sourceBuffer.buffered.length) {
      return;
    }

    const video = this._context.target.video;
    const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
    this._trimSourceBuffer(mediaSource, sourceBuffer, end);

    // While paused the user is holding a frame: leave the playhead alone (the
    // trim above still bounds memory) and do not sample the growing lag, which
    // would otherwise bias the catch-up rate once playback resumes. Resuming
    // jumps back to the live edge (see the play handler).
    if (video.paused) {
      return;
    }

    // Keep playback tracking the live edge as new media arrives.
    this._applyLiveEdgeAction(
      video,
      this._liveEdge.next({
        bufferedEndSeconds: end,
        currentTimeSeconds: video.currentTime,
        playbackRate: video.playbackRate,
        now: new Date(),
      }),
    );
  }

  private _applyLiveEdgeAction(video: HTMLVideoElement, action: LiveEdgeAction): void {
    if (action.action === 'seek') {
      video.currentTime = action.seconds;
    } else if (action.action === 'rate' && video.playbackRate !== action.rate) {
      video.playbackRate = action.rate;
    }
  }

  // Keep only the most recent RETAINED_BUFFER_SECONDS of media, trimming older
  // media and re-declaring the seekable range. The playhead is never snapped
  // here: while playing the live-edge tracker keeps it near the edge, and while
  // paused it is left holding its frame (a playhead that falls past the lag
  // bound is handled by a reconnect, not by dragging it forward).
  private _trimSourceBuffer(
    mediaSource: MediaSourceInterface,
    sourceBuffer: SourceBuffer,
    end: number,
  ): void {
    const retainedStart = end - RETAINED_BUFFER_SECONDS;
    const bufferedStart = sourceBuffer.buffered.start(0);

    if (retainedStart > bufferedStart) {
      sourceBuffer.remove(bufferedStart, retainedStart);
      mediaSource.setLiveSeekableRange(retainedStart, end);
    }
  }
}
