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

  // Universal key identifying "what this media belongs to" — a camera ID for
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

export interface MediaPlayerController {
  play(): Promise<void>;
  pause(): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): boolean;
  seek(seconds: number): Promise<void>;
  getScreenshotURL(): Promise<string | null>;
  // If no value for controls if specified, the player should use the default.
  setControls(controls?: boolean): Promise<void>;
  isPaused(): boolean;
  getFullscreenElement(): FullscreenElement | null;
  getPIPElement(): PIPElement | null;
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
