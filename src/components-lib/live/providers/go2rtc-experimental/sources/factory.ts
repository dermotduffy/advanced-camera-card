import type { Go2RTCMode } from '../../../../../config/schema/cameras';
import type { MediaSourceFactory } from '../adapters/media-source';
import type { PeerConnectionFactory } from '../adapters/peer-connection';
import type { StreamSource, StreamSourceContext } from '../types';
import { MJPEGStreamSource } from './mjpeg';
import { MP4StreamSource } from './mp4';
import { MSEStreamSource } from './mse';
import { WebRTCStreamSource, type MediaStreamFactory } from './webrtc';

// ===========================================================================
// Binary lane
// ===========================================================================

interface CreateBinarySourceOptions {
  createMediaSource?: MediaSourceFactory;
  userAgent?: string;
}

// Builds a source for a mode that streams binary media over the WebSocket (only
// one such mode runs per connection). WebRTC is created separately via
// `createWebRTCSource` because it runs in parallel and has its own interface.
export type BinarySourceFactory = (
  mode: Go2RTCMode,
  context: StreamSourceContext,
  options?: CreateBinarySourceOptions,
) => StreamSource | null;

// Returns null for modes with no binary source (i.e. `webrtc`, handled
// separately via `createWebRTCSource`).
export const createBinarySource: BinarySourceFactory = (
  mode: Go2RTCMode,
  context: StreamSourceContext,
  options?: CreateBinarySourceOptions,
): StreamSource | null => {
  switch (mode) {
    case 'mse':
      return new MSEStreamSource(context, options);
    case 'mp4':
      return new MP4StreamSource(context);
    case 'mjpeg':
      return new MJPEGStreamSource(context);
    default:
      return null;
  }
};

// ===========================================================================
// WebRTC lane
// ===========================================================================

export interface CreateWebRTCSourceOptions {
  createPeerConnection?: PeerConnectionFactory;
  createMediaStream?: MediaStreamFactory;
  microphoneStream?: MediaStream | null;
}

export type WebRTCSourceFactory = (
  context: StreamSourceContext,
  options?: CreateWebRTCSourceOptions,
) => WebRTCStreamSource;

export const createWebRTCSource: WebRTCSourceFactory = (
  context: StreamSourceContext,
  options?: CreateWebRTCSourceOptions,
): WebRTCStreamSource => new WebRTCStreamSource(context, options);
