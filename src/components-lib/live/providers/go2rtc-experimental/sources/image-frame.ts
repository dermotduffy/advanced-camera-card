import type { Go2RTCMode } from '../../../../../config/schema/cameras';
import {
  isServerErrorForMode,
  type Go2RTCMessage,
} from '../../../../../go2rtc/messages';
import type {
  MediaLoadedCapabilities,
  MediaTechnology,
  UnsubscribeCallback,
} from '../../../../../types';
import { Timer } from '../../../../../utils/timer';
import type {
  ImageStreamTarget,
  StreamProfile,
  StreamSource,
  StreamSourceContext,
} from '../types';

// Fail if no frame arrives within this window. The channel is open and the mode
// was requested, but the server may send neither a frame nor an error, so
// without this the source would hang silently instead of failing over. Mirrors
// the MSE negotiation and WebRTC connect timeouts.
const FIRST_FRAME_TIMEOUT_SECONDS = 5;

// Base for the modes that present a stream as a sequence of still images fed to
// the image surface (MJPEG, MP4): both receive binary frames and turn each into
// a single-image Blob, differing only in the request message and the per-frame
// conversion. These are last-resort fallbacks: no audio, no "real" playback.
export abstract class ImageFrameStreamSource implements StreamSource {
  protected _context: StreamSourceContext<ImageStreamTarget>;

  private _loaded = false;
  private _stopped = false;

  private _firstFrameTimer = new Timer();

  private _unsubscribe: UnsubscribeCallback | null = null;

  constructor(context: StreamSourceContext<ImageStreamTarget>) {
    this._context = context;
  }

  protected abstract _mode: Go2RTCMode;
  protected abstract _getRequestMessage(): Go2RTCMessage;
  protected abstract _handleFrame(data: ArrayBuffer): void;

  public start(): void {
    // Arm before wiring up the channel: a synchronous channel could deliver the
    // first frame during send(), which must be able to stop an already-armed
    // timer rather than have start() arm one that never stops.
    this._firstFrameTimer.start(FIRST_FRAME_TIMEOUT_SECONDS, () =>
      this._context.callbacks.failedCallback('connect_timeout'),
    );

    this._unsubscribe = this._context.channel.subscribeToMessages((message) => {
      if (isServerErrorForMode(message, this._mode)) {
        this._context.callbacks.failedCallback('server_error');
      }
    });
    this._context.channel.setBinaryCallback((data) => this._handleFrame(data));
    this._context.channel.send(this._getRequestMessage());
  }

  public stop(): void {
    this._stopped = true;
    this._firstFrameTimer.stop();
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._context.channel.setBinaryCallback(null);

    this._teardown();
  }

  public getCapabilities(): MediaLoadedCapabilities {
    return { supportsPause: false };
  }

  public getTechnology(): MediaTechnology[] {
    return [this._mode];
  }

  public getStreamProfile(): StreamProfile {
    return { hasVideo: true, hasH265Video: false, hasAudio: false, hasAACAudio: false };
  }

  // Show a rendered frame and, on the first one, report the stream loaded.
  protected async _showFrame(frame: Blob): Promise<void> {
    // MP4 turns each frame into a Blob asynchronously (canvas.toBlob), so a
    // frame can arrive here after stop(). Drop it so a stopped source never
    // writes to the shared image surface or reports a stale load.
    if (this._stopped) {
      return;
    }

    const decoded = this._context.target.showFrame(frame);

    if (this._loaded) {
      return;
    }
    this._loaded = true;
    this._firstFrameTimer.stop();

    // Report loaded only once the frame has decoded: the media-loaded info is
    // built by reading the <img> dimensions, and an <img> whose src was just
    // set still reports 0x0 (which is rejected as invalid), so reporting
    // synchronously would leave the media stuck "not loading".
    await decoded;
    if (!this._stopped) {
      this._context.callbacks.loadedCallback();
    }
  }

  protected _teardown(): void {}
}
