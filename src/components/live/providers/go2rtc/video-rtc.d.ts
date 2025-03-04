import { MediaPlayerController } from '../../../../types';

export class VideoRTC extends HTMLElement {
  DISCONNECT_TIMEOUT: number;
  RECONNECT_TIMEOUT: number;
  CODECS: string[];
  mode: string;
  background: boolean;
  visibilityThreshold: number;
  visibilityCheck: boolean;
  pcConfig: RTCConfiguration;
  wsState: number;
  pcState: number;
  video: HTMLVideoElement | null;
  ws: WebSocket | null;
  wsURL: string;
  pc: RTCPeerConnection | null;
  connectTS: number;
  mseCodecs: string;

  src: string | URL;

  oninit(): void;
  send(value: unknown): void;
  onpcvideo(ev: Event): void;
  onconnect(): void;
  ondisconnect(): void;
  onclose(): void;
  onopen(): void;
  onwebrtc(): void;
  onmessage: Record<string, (msg: { type: string; value: string }) => void>;

  // Custom methods/members.
  mediaPlayerController: MediaPlayerController | null;
  microphoneStream: MediaStream | null;
  reconnect();
  setControls(controls: boolean): void;
}
