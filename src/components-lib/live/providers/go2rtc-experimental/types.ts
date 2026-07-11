import { z } from 'zod';

import type {
  MediaLoadedCapabilities,
  MediaTechnology,
  UnsubscribeCallback,
} from '../../../../types';

// ===========================================================================
// Control messages
// ===========================================================================

// go2rtc control messages are JSON text frames of this shape; media flows as
// separate binary frames.
export const go2RTCMessageSchema = z.object({
  type: z.string(),

  // Per-type payload (a codec list, an SDP, an ICE candidate, error text, ...):
  // absent for some types (e.g. mjpeg) and not always a string, so it is typed
  // `unknown` and each handler narrows it before use.
  value: z.unknown().optional(),
});
export type Go2RTCMessage = z.infer<typeof go2RTCMessageSchema>;

export type MessageCallback = (message: Go2RTCMessage) => void;
export type BinaryCallback = (data: ArrayBuffer) => void;

// ===========================================================================
// Signaling channel
// ===========================================================================

// A session's two parallel delivery paths: 'binary' (MSE/MP4/MJPEG media over
// the WebSocket) and 'webrtc' (media over the peer connection).
export type Lane = 'binary' | 'webrtc';

// The narrow view of the signaling channel that stream sources receive: they
// may exchange messages but not manage the connection.
export interface StreamSourceChannel {
  send(message: Go2RTCMessage): void;
  subscribeToMessages(callback: MessageCallback): UnsubscribeCallback;
  setBinaryCallback(callback: BinaryCallback | null): void;
}

// ===========================================================================
// Render targets
// ===========================================================================

// Surface vs Target: A "target" is where a source (binary vs webrtc) puts its
// frames for one mode: a <video> element, or an <img> element (via a showFrame
// callback). The component adds a media-player controller to a target to make a
// fuller "surface" (see SessionSurfaces in session-controller.ts); it hands a
// source only the target, never the surface, so a source cannot reach the
// controller.

// What a source renders onto: the real <video> for modes the browser plays
// (MSE, WebRTC), or an image sink fed decoded frames for modes presented as a
// sequence of still images (MP4, MJPEG).
export interface VideoStreamTarget {
  kind: 'video';
  video: HTMLVideoElement;
}

// A frame is handed over as a Blob rather than exposing the raw <img> so the
// object-URL lifecycle (create, revoke the previous) stays owned by the image
// surface, not each source.
export interface ImageStreamTarget {
  kind: 'image';
  showFrame(frame: Blob): void;
}

type StreamSourceTarget = VideoStreamTarget | ImageStreamTarget;

// Which of the two render surfaces media is shown on: the real <video> or the
// <img>. Matches the `kind` of the corresponding stream target.
export type SurfaceKind = 'video' | 'image';

// ===========================================================================
// Stream sources
// ===========================================================================

// Describes a source's negotiated media, used to arbitrate the MSE-vs-WebRTC
// race. The bit-weighted comparison lives in `utils/source-priority.ts`.
export interface StreamProfile {
  hasVideo: boolean;
  hasH265Video: boolean;
  hasAudio: boolean;

  // The MSE audio score is inferred from the negotiated codec string, not an
  // observed track, so it counts only AAC -- the audio codec browsers decode
  // reliably via MSE. Opus and FLAC over MSE are inconsistently supported, so
  // crediting them could prefer a stream whose audio never plays.
  hasAACAudio: boolean;
}

export type StreamSourceFailureReason =
  | 'two_way_audio_error'
  | 'buffer_overflow'
  | 'connect_timeout'
  | 'media_error'
  | 'negotiation_timeout'
  | 'server_error'
  | 'unsupported';

export interface StreamSourceCallbacks {
  loadedCallback: () => void;
  failedCallback: (reason: StreamSourceFailureReason) => void;
}

export interface StreamSourceContext<T extends StreamSourceTarget = StreamSourceTarget> {
  target: T;
  channel: StreamSourceChannel;
  callbacks: StreamSourceCallbacks;
}

// A single streaming mode implementation (e.g. MSE). Sources negotiate over the
// shared channel, attach media to the provided video element, and report
// readiness or failure via callbacks; connection management and failure
// recovery belong to the session not the source.
export interface StreamSource {
  // Single-use: start() begins the source and stop() tears it down for good.
  start(): void;
  stop(): void;

  getCapabilities(): MediaLoadedCapabilities;
  getTechnology(): MediaTechnology[];
  getStreamProfile(): StreamProfile;
}
