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
} from '../types';
import { BoundedBufferQueue } from '../utils/bounded-buffer-queue';
import {
  convertToCodecString,
  getCodecsForUserAgent,
  selectSupportedCodecs,
} from '../utils/codecs';
import { LiveEdgeTracker, type LiveEdgeAction } from '../utils/live-edge-tracker';
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

// Seconds of media retained behind the live edge; older media is trimmed.
const RETAINED_BUFFER_SECONDS = 5;

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
  private _context: StreamSourceContext;

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

  constructor(context: StreamSourceContext, options?: MSEStreamSourceOptions) {
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
    this._context.video.addEventListener('loadeddata', this._loadedHandler);
    this._context.video.addEventListener('error', this._errorHandler);
    mediaSource.attach(this._context.video);
  }

  public stop(): void {
    this._negotiationTimer.stop();

    this._unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this._unsubscribeCallbacks = [];

    this._context.video.removeEventListener('loadeddata', this._loadedHandler);
    this._context.video.removeEventListener('error', this._errorHandler);

    this._context.channel.setBinaryCallback(null);

    this._mediaSource?.detach(this._context.video);
    this._mediaSource = null;

    this._sourceBuffer = null;

    this._pendingBuffer.clear();
  }

  public getCapabilities(): MediaLoadedCapabilities {
    return {
      supportsPause: true,
      hasAudio: hasAudio(this._context.video, { mseCodecs: this._codecs }),
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

    const pending = this._pendingBuffer.shift();
    if (pending) {
      this._append(sourceBuffer, pending);
      return;
    }

    if (!sourceBuffer.buffered.length) {
      return;
    }

    const video = this._context.video;
    const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
    this._trimSourceBuffer(mediaSource, sourceBuffer, end);

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
  // media and re-declaring the seekable range; snap the playhead forward if it
  // fell out of the retained window (e.g. after a background tab).
  private _trimSourceBuffer(
    mediaSource: MediaSourceInterface,
    sourceBuffer: SourceBuffer,
    end: number,
  ): void {
    const video = this._context.video;
    const retainedStart = end - RETAINED_BUFFER_SECONDS;
    const bufferedStart = sourceBuffer.buffered.start(0);

    if (retainedStart > bufferedStart) {
      sourceBuffer.remove(bufferedStart, retainedStart);
      mediaSource.setLiveSeekableRange(retainedStart, end);
    }

    if (video.currentTime < retainedStart) {
      video.currentTime = retainedStart;
    }
  }
}
