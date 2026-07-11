import type { Go2RTCMessage } from '../types';
import { ImageFrameStreamSource } from './image-frame';

// Each binary frame is a complete JPEG, shown directly as an image frame.
export class MJPEGStreamSource extends ImageFrameStreamSource {
  protected _mode = 'mjpeg' as const;

  protected _getRequestMessage(): Go2RTCMessage {
    return { type: 'mjpeg' };
  }

  protected _handleFrame(data: ArrayBuffer): void {
    this._showFrame(new Blob([data], { type: 'image/jpeg' }));
  }
}
