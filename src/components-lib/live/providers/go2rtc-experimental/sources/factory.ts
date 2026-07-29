import type { Go2RTCMode } from '../../../../../config/schema/cameras';
import type { MediaSourceFactory } from '../adapters/media-source';
import type { PeerConnectionFactory } from '../adapters/peer-connection';
import type {
  ImageStreamTarget,
  StreamSource,
  StreamSourceCallbacks,
  StreamSourceChannel,
  StreamSourceContext,
  SurfaceKind,
  VideoStreamTarget,
} from '../types';
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

// The available render targets, one of which each mode is wired to. The factory
// is the single place that maps a mode to its surface, so it reports back which
// one it chose.
export interface BinaryStreamTargets {
  video: VideoStreamTarget;
  image: ImageStreamTarget;
}

export interface BinarySource {
  source: StreamSource;
  surface: SurfaceKind;
}

// Builds a source for a mode that streams binary media over the WebSocket (only
// one such mode runs per connection). WebRTC is created separately via
// `createWebRTCSource` because it runs in parallel and has its own interface.
export type BinarySourceFactory = (
  mode: Go2RTCMode,
  targets: BinaryStreamTargets,
  channel: StreamSourceChannel,
  callbacks: StreamSourceCallbacks,
  options?: CreateBinarySourceOptions,
) => BinarySource | null;

// Returns null for modes with no binary source (i.e. `webrtc`, handled
// separately via `createWebRTCSource`).
export const createBinarySource: BinarySourceFactory = (
  mode: Go2RTCMode,
  targets: BinaryStreamTargets,
  channel: StreamSourceChannel,
  callbacks: StreamSourceCallbacks,
  options?: CreateBinarySourceOptions,
): BinarySource | null => {
  switch (mode) {
    case 'mse':
      return {
        source: new MSEStreamSource(
          { target: targets.video, channel, callbacks },
          options,
        ),
        surface: 'video',
      };
    case 'mp4':
      return {
        source: new MP4StreamSource({ target: targets.image, channel, callbacks }),
        surface: 'image',
      };
    case 'mjpeg':
      return {
        source: new MJPEGStreamSource({ target: targets.image, channel, callbacks }),
        surface: 'image',
      };
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
  microphoneErrorCallback?: (error?: string) => void;
}

export type WebRTCSourceFactory = (
  context: StreamSourceContext<VideoStreamTarget>,
  options?: CreateWebRTCSourceOptions,
) => WebRTCStreamSource;

export const createWebRTCSource: WebRTCSourceFactory = (
  context: StreamSourceContext<VideoStreamTarget>,
  options?: CreateWebRTCSourceOptions,
): WebRTCStreamSource => new WebRTCStreamSource(context, options);
