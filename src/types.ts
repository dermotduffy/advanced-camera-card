import {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
  Themes,
} from '@dermotduffy/custom-card-helpers';
import { z } from 'zod';

export type ClipsOrSnapshots = 'clips' | 'snapshots';
export type ClipsOrSnapshotsOrAll = 'clips' | 'snapshots' | 'all';

export class AdvancedCameraCardError extends Error {
  context?: unknown;

  constructor(message: string, context?: unknown) {
    super(message);
    this.context = context;
  }
}

export interface ExtendedHomeAssistant extends HomeAssistant {
  hassUrl(path?): string;
  themes: Themes & {
    darkMode?: boolean;
  };
}

export interface MediaLoadedCapabilities {
  supports2WayAudio?: boolean;
  supportsPause?: boolean;
  hasAudio?: boolean;
}

const MEDIA_TECHNOLOGY = ['hls', 'jpg', 'jsmpeg', 'mjpeg', 'mp4', 'mse', 'webrtc'];
export type MediaTechnology = (typeof MEDIA_TECHNOLOGY)[number];

export interface MediaLoadedInfo {
  width: number;
  height: number;
  technology?: MediaTechnology[];
  player?: AdvancedCameraCardMediaPlayer;
  capabilities?: MediaLoadedCapabilities;
}

export type MessageType = 'info' | 'error' | 'connection' | 'diagnostics';

export interface Message {
  message: string;
  type?: MessageType;
  icon?: string;
  context?: unknown;
  dotdotdot?: boolean;
  troubleshootingURL?: string;
}

export type WebkitHTMLVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen: boolean;
  webkitSupportsFullscreen: boolean;
  webkitEnterFullscreen: () => void;
  webkitExitFullscreen: () => void;
};

export type FullscreenElement = HTMLElement;

export interface AdvancedCameraCardMediaPlayer {
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

export type LovelaceCardWithEditor = LovelaceCard & {
  constructor: {
    getConfigElement(): Promise<LovelaceCardEditor>;
  };
};

export interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): Promise<LovelaceCardWithEditor>;
}

export type PTZMovementType = 'relative' | 'continuous';

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

// *************************************************************************
//                     Home Assistant API types.
// *************************************************************************

// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_source/models.py
export const resolvedMediaSchema = z.object({
  url: z.string(),
  mime_type: z.string(),
});
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

export const signedPathSchema = z.object({
  path: z.string(),
});
export type SignedPath = z.infer<typeof signedPathSchema>;
