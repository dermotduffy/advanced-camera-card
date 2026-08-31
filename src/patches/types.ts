import type { HassEntity } from 'home-assistant-js-websocket';
import type { CSSResultGroup, LitElement, nothing, TemplateResult } from 'lit';

import type { HomeAssistant } from '../ha/types.js';
import type { MediaPlayer } from '../types.js';

// The Home Assistant elements the card subclasses are only registered at
// runtime, so their source is unavailable at compilation time. The declarations
// below name the members each patch uses, taken from the Home Assistant
// frontend source linked at the top of each patch. They deliberately describe
// only that subset.

// A camera entity, whose `access_token` attribute the MJPEG stream URL is built
// from.
export interface CameraEntity extends HassEntity {
  attributes: HassEntity['attributes'] & {
    access_token?: string;
  };
}

// The stream types Home Assistant can serve from a camera entity. MJPEG is not
// among them: it is the fallback `ha-camera-stream` renders itself.
type HaStreamType = 'hls' | 'web_rtc';

// What a player reports about the stream it loaded, on the `streams` event.
interface HaStreamStatus {
  hasAudio: boolean;
  hasVideo: boolean;
}

// One of the candidate streams `ha-camera-stream` renders. Only one is visible;
// the rest are rendered hidden so they are ready to be promoted.
export interface HaStream {
  type: HaStreamType | 'mjpeg';
  visible: boolean;
}

// https://github.com/home-assistant/frontend/blob/dev/src/components/ha-hls-player.ts
declare class HaHlsPlayerElement extends LitElement {
  static override styles: CSSResultGroup;

  entityid?: string;
  url?: string;
  posterUrl?: string;
  controls: boolean;
  muted: boolean;
  autoPlay: boolean;
  playsInline: boolean;
  allowExoPlayer: boolean;

  protected _error?: string;

  // Whether `_error` stopped the stream, as opposed to one the player went on
  // to recover from by itself.
  protected _errorIsFatal: boolean;

  protected _loadedData(): void;
}

// https://github.com/home-assistant/frontend/blob/dev/src/components/ha-web-rtc-player.ts
declare class HaWebRtcPlayerElement extends LitElement {
  static override styles: CSSResultGroup;

  entityid?: string;
  posterUrl?: string;
  controls: boolean;
  muted: boolean;
  autoPlay: boolean;
  playsInline: boolean;

  protected _error?: string;

  protected _videoEl: HTMLVideoElement;
  protected _peerConnection?: RTCPeerConnection;
  protected _remoteStream?: MediaStream;

  protected _startWebRtc(): Promise<void>;
  protected _addTrack: (event: RTCTrackEvent) => Promise<void>;
  protected _cleanUp(): void;
  protected _loadedData(): void;
}

// https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
declare class HaCameraStreamElement extends LitElement {
  static override styles: CSSResultGroup;

  stateObj?: CameraEntity;
  controls: boolean;
  muted: boolean;
  allowExoPlayer: boolean;

  protected _posterUrl?: string;
  protected _connected: boolean;
  protected _capabilities?: { frontend_stream_types: HaStreamType[] };
  protected _hlsStreams?: HaStreamStatus;
  protected _webRtcStreams?: HaStreamStatus;

  protected _handleHlsStreams(ev: CustomEvent): void;
  protected _handleWebRtcStreams(ev: CustomEvent): void;

  // Picks which of the camera's streams to render and which one is visible.
  protected _streams(
    supportedTypes?: HaStreamType[],
    hlsStreams?: HaStreamStatus,
    webRtcStreams?: HaStreamStatus,
    muted?: boolean,
  ): HaStream[];

  protected _renderStream(stream: HaStream): TemplateResult | typeof nothing;
}

// `customElements.get()` cannot know which element a tag resolves to, so each
// patch casts its base to the matching constructor.
export type ConstructableHaHlsPlayer = typeof HaHlsPlayerElement;
export type ConstructableHaWebRtcPlayer = typeof HaWebRtcPlayerElement;
export type ConstructableHaCameraStream = typeof HaCameraStreamElement;

// The elements the card registers: the Home Assistant element plus the card's
// own additions. `hass` is set by the card rather than declared by the Home
// Assistant element, which takes its connection from a context instead.
export type AdvancedCameraCardHaHlsPlayerElement = HaHlsPlayerElement &
  MediaPlayer & { hass?: HomeAssistant; targetID?: string };
export type AdvancedCameraCardHaWebRtcPlayerElement = HaWebRtcPlayerElement &
  MediaPlayer & { hass?: HomeAssistant; targetID?: string };
export type AdvancedCameraCardHaCameraStreamElement = HaCameraStreamElement &
  MediaPlayer & { hass?: HomeAssistant; targetID?: string; outputMute: boolean };
