import { OffscreenVideo, type VideoElementFactory } from '../offscreen-video';
import type { Go2RTCMessage, StreamSourceContext } from '../types';
import { arrayBufferToBase64 } from '../utils/base64';
import {
  convertToCodecString,
  GO2RTC_CODECS,
  selectSupportedCodecs,
} from '../utils/codecs';
import { PosterStreamSource } from './poster';

type CanvasElementFactory = () => HTMLCanvasElement;

interface MP4StreamSourceOptions {
  createVideoElement?: VideoElementFactory;
  createCanvasElement?: CanvasElementFactory;
}

// Each binary frame is a standalone MP4 holding one keyframe. Unlike JPEG it
// cannot be shown directly, so it is decoded in an off-screen video and drawn
// to a canvas to produce the image.
export class MP4StreamSource extends PosterStreamSource {
  protected _mode = 'mp4' as const;

  private _decoder: OffscreenVideo;
  private _createCanvasElement: CanvasElementFactory;
  private _canvas: HTMLCanvasElement | null = null;

  constructor(context: StreamSourceContext, options?: MP4StreamSourceOptions) {
    super(context);

    const createVideo =
      options?.createVideoElement ?? (() => document.createElement('video'));
    this._decoder = new OffscreenVideo(() => {
      const video = createVideo();
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.addEventListener('loadeddata', () => this._drawFrame(video));
      return video;
    });

    this._createCanvasElement =
      options?.createCanvasElement ?? (() => document.createElement('canvas'));
  }

  protected _getRequestMessage(): Go2RTCMessage {
    return {
      type: 'mp4',
      value: convertToCodecString(
        selectSupportedCodecs(
          GO2RTC_CODECS,
          { audio: false, video: true },
          (mimeType) => !!this._context.video.canPlayType(mimeType),
        ),
      ),
    };
  }

  protected _handleFrame(data: ArrayBuffer): void {
    this._decoder.get().src = 'data:video/mp4;base64,' + arrayBufferToBase64(data);
  }

  protected _teardown(): void {
    this._decoder.clear();
    this._canvas = null;
  }

  private _drawFrame(decoder: HTMLVideoElement): void {
    const canvas = (this._canvas ??= this._createCanvasElement());

    // Reassigning a canvas dimension reallocates its backing buffer, so skip it
    // when the video size is unchanged.
    if (canvas.width !== decoder.videoWidth || canvas.height !== decoder.videoHeight) {
      canvas.width = decoder.videoWidth;
      canvas.height = decoder.videoHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.drawImage(decoder, 0, 0, canvas.width, canvas.height);
    this._showPoster(canvas.toDataURL('image/jpeg'));
  }
}
