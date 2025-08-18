import { z } from 'zod';
import { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from './ha/types';

export type ClipsOrSnapshots = 'clips' | 'snapshots';
export type ClipsOrSnapshotsOrAll = 'clips' | 'snapshots' | 'all';

export class AdvancedCameraCardError extends Error {
  context?: unknown;

  constructor(message: string, context?: unknown) {
    super(message);
    this.context = context;
  }
}

export interface MediaLoadedCapabilities {
  supports2WayAudio?: boolean;
  supportsPause?: boolean;
  hasAudio?: boolean;
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

  'favorite-events'?: boolean;
  'favorite-recordings'?: boolean;

  'remote-control-entity'?: boolean;

  seek?: boolean;

  ptz?: PTZCapabilities;

  menu?: boolean;

  trigger?: boolean;
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
  'seek',
  'snapshots',
  'substream',
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
