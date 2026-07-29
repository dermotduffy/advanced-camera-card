import { z } from 'zod';

import type { EffectOptions } from './card-controller/effects/types';
import type { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from './ha/types';

// UI-facing media types for galleries and views.
export const VIEW_MEDIA_TYPES = ['clips', 'snapshots', 'recordings', 'reviews'] as const;
export type ViewMediaType = (typeof VIEW_MEDIA_TYPES)[number];

export class AdvancedCameraCardError extends Error {
  context?: unknown;

  constructor(message: string, context?: unknown) {
    super(message);
    this.context = context;
  }
}

export interface MediaLoadedCapabilities {
  supportsPause?: boolean;

  hasAudio?: boolean;

  // Note: This is whether the current stream already _has_ 2-way audio, not
  // whether the underlying camera _could_ establish 2 way audio. For the
  // latter, consult the camera's capabilities ('2-way-audio').
  has2WayAudio?: boolean;
}

export type MediaTechnology =
  | 'hls'
  | 'jpg'
  | 'jsmpeg'
  | 'mjpeg'
  | 'mp4'
  | 'mse'
  | 'webrtc';

export interface MediaLoadedInfo {
  width: number;
  height: number;
  technology?: MediaTechnology[];

  mediaPlayerController?: MediaPlayerController;
  capabilities?: MediaLoadedCapabilities;

  // Universal key identifying "what this media belongs to" -- a camera ID for
  // live, a media ID for the viewer, or a sentinel for the image view.
  targetID?: string;
}

export type UntargetedMediaLoadedInfo = Omit<MediaLoadedInfo, 'targetID'>;

// Opaque token used to tag the source of a MediaLoadedInfo entry. The
// dispatching element from the source controller's bubble path is always an
// HTMLElement, and reference equality is the only operation we perform on it.
export type MediaLoadedInfoOwner = HTMLElement;

export interface MediaLoadedInfoEventDetail {
  info: MediaLoadedInfo;

  // Aborts when the source retires this media. The source aborts on host
  // disconnect, and when a subsequent `set()` arrives under a different
  // `targetID` (replacing this dispatch). Independent of DOM connectedness, so
  // cleanup works after `parentNode` becomes null. Recipients along the bubble
  // path register cleanup synchronously while handling the load event with
  // `signal.addEventListener('abort', callback)`.
  signal: AbortSignal;
}

export type WebkitHTMLVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen: boolean;
  webkitSupportsFullscreen: boolean;
  webkitEnterFullscreen: () => void;
  webkitExitFullscreen: () => void;
};

export type FullscreenElement = HTMLElement;
export type PIPElement = HTMLVideoElement;

export type UnsubscribeCallback = () => void;

// Reports each live/stalled transition of a player's media stream.
export type LivenessCallback = (isLive: boolean) => void;

// Control over a pausable playback loop. Optional on the player: present only
// when the player owns a stream it can start and stop (e.g. a real video, or an
// image refreshed on a timer). A static image, or one fed frames as they arrive
// where the client has no control (e.g. MP4, MJPEG), has no pausable loop and
// omits it.
export interface PlaybackControl {
  play(): Promise<void>;
  pause(): Promise<void>;
  isPaused(): boolean;
}

export interface MediaPlayerController {
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): boolean;
  getScreenshotURL(): Promise<string | null>;

  // If no value for controls if specified, the player should use the default.
  setControls(controls?: boolean): Promise<void>;
  getFullscreenElement(): FullscreenElement | null;
  getPIPElement(): PIPElement | null;

  // Jump to a time position, if the media has a seekable timeline. Optional:
  // implemented only by players over seekable media.
  seek?(seconds: number): Promise<void>;

  // Start/pause the media, if it is pausable. Optional: implemented only by
  // players that own a pausable playback loop.
  playback?: PlaybackControl;

  // Observe whether the player is actively delivering media, so a silent freeze
  // (frames stop advancing while playing) can be detected. Optional:
  // implemented only by players that can observe their own frame progress. The
  // callback fires on each live/stalled transition; the returned callback stops
  // the observation.
  subscribeLiveness?(callback: LivenessCallback): UnsubscribeCallback;
}

export interface MediaPlayer {
  getMediaPlayerController(): Promise<MediaPlayerController | null>;
}

export type MediaPlayerElement<T extends HTMLElement = HTMLElement> = T & MediaPlayer;

export type LovelaceCardWithEditor = LovelaceCard & {
  constructor: {
    getConfigElement(): Promise<LovelaceCardEditor>;
  };
};

export interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): Promise<LovelaceCardWithEditor>;
}

export enum PTZMovementType {
  Relative = 'relative',
  Continuous = 'continuous',
}

export interface PTZCapabilities {
  left?: PTZMovementType[];
  right?: PTZMovementType[];
  up?: PTZMovementType[];
  down?: PTZMovementType[];
  zoomIn?: PTZMovementType[];
  zoomOut?: PTZMovementType[];

  presets?: string[];
}

export interface CapabilitiesRaw {
  live?: boolean;
  substream?: boolean;

  clips?: boolean;
  recordings?: boolean;
  snapshots?: boolean;
  reviews?: boolean;

  'favorite-events'?: boolean;
  'favorite-recordings'?: boolean;

  'remote-control-entity'?: boolean;

  seek?: boolean;

  ptz?: PTZCapabilities;

  menu?: boolean;

  trigger?: boolean;

  '2-way-audio'?: boolean;
}

export type CapabilityKey = keyof CapabilitiesRaw;
export const capabilityKeys: readonly [CapabilityKey, ...CapabilityKey[]] = [
  'clips',
  'remote-control-entity',
  'favorite-events',
  'favorite-recordings',
  'live',
  'menu',
  'ptz',
  'recordings',
  'reviews',
  'seek',
  'snapshots',
  'substream',
  '2-way-audio',
  'trigger',
] as const;

export interface Interaction {
  action: string;
}

export interface Endpoint {
  endpoint: string;
  sign?: boolean;
}

export const signedPathSchema = z.object({
  path: z.string(),
});
export type SignedPath = z.infer<typeof signedPathSchema>;

export type EffectName =
  | 'check'
  | 'fireworks'
  | 'ghost'
  | 'hearts'
  | 'shamrocks'
  | 'snow';

export type EffectsContainer = HTMLElement | DocumentFragment;
export interface EffectsManagerInterface {
  startEffect(name: EffectName, options?: EffectOptions): Promise<void>;
  stopEffect(effect: EffectName): void;
  toggleEffect(effect: EffectName, options?: EffectOptions): Promise<void>;

  setContainer(container: EffectsContainer): void;
  removeContainer(): void;
}

// Type the cus-tom `media:loaded` event globally so `addEventListener` and
// `removeEventListener` accept a properly-typed handler on any HTMLElement
// without an `as` cast. Standard TS pattern via module augmentation of the
// platform's event-map interfaces.
declare global {
  interface HTMLElementEventMap {
    'advanced-camera-card:media:loaded': CustomEvent<MediaLoadedInfoEventDetail>;
  }
}
