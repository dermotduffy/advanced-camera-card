import type { Go2RTCMessage } from '../../../../../go2rtc/messages';
import { OffscreenVideo, type VideoElementFactory } from '../offscreen-video';
import type { ImageStreamTarget, StreamSourceContext } from '../types';
import { arrayBufferToBase64 } from '../utils/base64';
import {
  convertToCodecString,
  GO2RTC_CODECS,
  selectSupportedCodecs,
} from '../utils/codecs';
import { ImageFrameStreamSource } from './image-frame';

type CanvasElementFactory = () => HTMLCanvasElement;

interface MP4StreamSourceOptions {
  createVideoElement?: VideoElementFactory;
  createCanvasElement?: CanvasElementFactory;
}

// Each binary frame is a standalone MP4 holding one keyframe. Unlike JPEG it
// cannot be shown directly, so it is decoded in an off-screen video and drawn
// to a canvas to produce the image.
export class MP4StreamSource extends ImageFrameStreamSource {
  protected _mode = 'mp4' as const;

  private _decoder: OffscreenVideo;
  private _createCanvasElement: CanvasElementFactory;
  private _canvas: HTMLCanvasElement | null = null;

  constructor(
    context: StreamSourceContext<ImageStreamTarget>,
    options?: MP4StreamSourceOptions,
  ) {
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
    // Codec support is probed on the decoder video, since that is what plays
    // the incoming MP4 frames; the image surface onto which this is rendered
    // has has no video element of its own.
    const decoder = this._decoder.get();
    return {
      type: 'mp4',
      value: convertToCodecString(
        selectSupportedCodecs(
          GO2RTC_CODECS,
          { audio: false, video: true },
          (mimeType) => !!decoder.canPlayType(mimeType),
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
    canvas.toBlob((frame) => {
      if (frame) {
        /* v8 ignore next: This never rejects; the catch satisfies the no-floating-promises -- @preserve */
        this._showFrame(frame).catch(() => {});
      }
    }, 'image/jpeg');
  }
}
