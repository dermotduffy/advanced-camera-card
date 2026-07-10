import type { Go2RTCMessage } from '../types';
import { arrayBufferToBase64 } from '../utils/base64';
import { PosterStreamSource } from './poster';

// TODO: Evaluate changing the poster to an <img>.
// Each binary frame is a complete JPEG, shown directly as the video poster.
export class MJPEGStreamSource extends PosterStreamSource {
  protected _mode = 'mjpeg' as const;

  protected _getRequestMessage(): Go2RTCMessage {
    return { type: 'mjpeg' };
  }

  protected _handleFrame(data: ArrayBuffer): void {
    this._showPoster('data:image/jpeg;base64,' + arrayBufferToBase64(data));
  }
}
