import { z } from 'zod';
import type { EffectOptions } from './card-controller/effects/types';
import type { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from './ha/types';
import { Severity } from './severity';

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

  // Whether or not this media is a placeholder (temporary image) whilst another
  // media item is being loaded.
  placeholder?: boolean;
}

export type MessageType = 'info' | 'error' | 'connection' | 'diagnostics';
export interface MessageURL {
  link: string;
  title: string;
}

export interface Message {
  message: string;
  type?: MessageType;
  icon?: string;
  context?: unknown;
  dotdotdot?: boolean;
  url?: MessageURL;
}

export interface MetadataField {
  title: string;
  icon?: Icon;
  hint?: string;
  emphasis?: Severity;
}

export interface OverlayMessageControl extends MetadataField {
  callback: () => OverlayMessage | null | Promise<OverlayMessage | null>;
}

export interface OverlayMessage {
  heading?: MetadataField;
  controls?: OverlayMessageControl[];
  details?: MetadataField[];
  text?: string;
}

export type WebkitHTMLVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen: boolean;
  webkitSupportsFullscreen: boolean;
  webkitEnterFullscreen: () => void;
  webkitExitFullscreen: () => void;
};

export type FullscreenElement = HTMLElement;

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

export interface Icon {
  // If set, this icon will be used.
  icon?: string;

  // If icon is not set, this entity's icon will be used (and HA will be asked
  // to render it).
  entity?: string;

  // Whether or not to change the icon color depending on entity state.
  stateColor?: boolean;

  // If an icon is not otherwise resolved / available, this will be used instead.
  fallback?: string;
}

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
