import type { Go2RTCMode } from '../../../../../config/schema/cameras';
import type { MediaLoadedCapabilities, MediaTechnology } from '../../../../../types';
import { setControlsOnVideo } from '../../../../../utils/controls';
import type {
  Go2RTCMessage,
  StreamProfile,
  StreamSource,
  StreamSourceContext,
  UnsubscribeCallback,
} from '../types';
import { isServerErrorForMode } from '../utils/messages';

// Base for the modes that present a stream as a sequence of still images on the
// video's `poster` (MJPEG, MP4): both receive binary frames and turn each into
// a `data:` URL poster, differing only in the request message and the per-frame
// conversion. These are last-resort fallbacks: no audio, no "real" playback.
export abstract class PosterStreamSource implements StreamSource {
  protected _context: StreamSourceContext;

  private _loaded = false;

  private _unsubscribe: UnsubscribeCallback | null = null;

  constructor(context: StreamSourceContext) {
    this._context = context;
  }

  protected abstract _mode: Go2RTCMode;
  protected abstract _getRequestMessage(): Go2RTCMessage;
  protected abstract _handleFrame(data: ArrayBuffer): void;

  public start(): void {
    // Image based streams have no meaningful playback controls.
    setControlsOnVideo(this._context.video, false);

    this._unsubscribe = this._context.channel.subscribeToMessages((message) => {
      if (isServerErrorForMode(message, this._mode)) {
        this._context.callbacks.failedCallback('server_error');
      }
    });
    this._context.channel.setBinaryCallback((data) => this._handleFrame(data));
    this._context.channel.send(this._getRequestMessage());
  }

  public stop(): void {
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
  protected _showPoster(dataURL: string): void {
    this._context.video.poster = dataURL;

    if (!this._loaded) {
      this._loaded = true;
      this._context.callbacks.loadedCallback();
    }
  }

  protected _teardown(): void {}
}
