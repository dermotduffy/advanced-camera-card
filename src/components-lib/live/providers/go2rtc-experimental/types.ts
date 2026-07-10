import { z } from 'zod';

import type {
  MediaLoadedCapabilities,
  MediaTechnology,
  UnsubscribeCallback,
} from '../../../../types';

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

interface StreamSourceCallbacks {
  loadedCallback: () => void;
  failedCallback: (reason: StreamSourceFailureReason) => void;
}

export interface StreamSourceContext {
  video: HTMLVideoElement;
  channel: StreamSourceChannel;
  callbacks: StreamSourceCallbacks;
}

// A single streaming mode implementation (e.g. MSE). Sources negotiate over the
// shared channel, attach media to the provided video element, and report
// readiness or failure via callbacks; connection management and failure
// recovery belong to the session not the source.
export interface StreamSource {
  start(): void;
  stop(): void;

  getCapabilities(): MediaLoadedCapabilities;
  getTechnology(): MediaTechnology[];
  getStreamProfile(): StreamProfile;
}
