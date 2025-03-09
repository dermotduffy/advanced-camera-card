import {
  MediaLoadedCapabilities,
  MediaLoadedInfo,
  MediaPlayerController,
  MediaTechnology,
} from '../types.js';
import { fireAdvancedCameraCardEvent } from './fire-advanced-camera-card-event.js';

const MEDIA_INFO_HEIGHT_CUTOFF = 50;
const MEDIA_INFO_WIDTH_CUTOFF = MEDIA_INFO_HEIGHT_CUTOFF;

/**
 * Create a MediaLoadedInfo object.
 * @param source An event or HTMLElement that should be used as a source.
 * @returns A new MediaLoadedInfo object or null if one could not be created.
 */
export function createMediaLoadedInfo(
  source: Event | HTMLElement,
  options?: {
    mediaPlayerController?: MediaPlayerController;
    capabilities?: MediaLoadedCapabilities;
    technology?: MediaTechnology[];
  },
): MediaLoadedInfo | null {
  let target: HTMLElement | EventTarget;
  if (source instanceof Event) {
    target = source.composedPath()[0];
  } else {
    target = source;
  }

  if (target instanceof HTMLImageElement) {
    return {
      width: (target as HTMLImageElement).naturalWidth,
      height: (target as HTMLImageElement).naturalHeight,
      ...options,
    };
  } else if (target instanceof HTMLVideoElement) {
    return {
      width: (target as HTMLVideoElement).videoWidth,
      height: (target as HTMLVideoElement).videoHeight,
      ...options,
    };
  } else if (target instanceof HTMLCanvasElement) {
    return {
      width: (target as HTMLCanvasElement).width,
      height: (target as HTMLCanvasElement).height,
      mediaPlayerController: options?.mediaPlayerController,
      ...options,
    };
  }
  return null;
}

/**
 * Dispatch an Advanced Camera Card media loaded event.
 * @param element The element to send the event.
 * @param source An event or HTMLElement that should be used as a source.
 */
export function dispatchMediaLoadedEvent(
  target: HTMLElement,
  source: Event | HTMLElement,
  options?: {
    mediaPlayerController?: MediaPlayerController;
    capabilities?: MediaLoadedCapabilities;
    technology?: MediaTechnology[];
  },
): void {
  const mediaLoadedInfo = createMediaLoadedInfo(source, options);
  if (mediaLoadedInfo) {
    dispatchExistingMediaLoadedInfoAsEvent(target, mediaLoadedInfo);
  }
}

/**
 * Dispatch a pre-existing MediaLoadedInfo object as an event.
 * @param element The element to send the event.
 * @param mediaLoadedInfo The MediaLoadedInfo object to send.
 */
export function dispatchExistingMediaLoadedInfoAsEvent(
  target: EventTarget,
  mediaLoadedInfo: MediaLoadedInfo,
): void {
  fireAdvancedCameraCardEvent<MediaLoadedInfo>(target, 'media:loaded', mediaLoadedInfo);
}

/**
 * Dispatch a media unloaded event.
 * @param element The element to send the event.
 */
export function dispatchMediaUnloadedEvent(element: HTMLElement): void {
  fireAdvancedCameraCardEvent(element, 'media:unloaded');
}

export function dispatchMediaVolumeChangeEvent(target: HTMLElement): void {
  fireAdvancedCameraCardEvent(target, 'media:volumechange');
}

export function dispatchMediaPlayEvent(target: HTMLElement): void {
  fireAdvancedCameraCardEvent(target, 'media:play');
}

export function dispatchMediaPauseEvent(target: HTMLElement): void {
  fireAdvancedCameraCardEvent(target, 'media:pause');
}

/**
 * Determine if a MediaLoadedInfo object is valid/acceptable.
 * @param info The MediaLoadedInfo object.
 * @returns True if the object is valid, false otherwise.
 */
export function isValidMediaLoadedInfo(info: MediaLoadedInfo): boolean {
  return (
    info.height >= MEDIA_INFO_HEIGHT_CUTOFF && info.width >= MEDIA_INFO_WIDTH_CUTOFF
  );
}

// Facilitates correct typing of event handlers.
export interface AdvancedCameraCardMediaLoadedEventTarget extends EventTarget {
  addEventListener(
    event: 'advanced-camera-card:media:loaded',
    listener: (
      this: AdvancedCameraCardMediaLoadedEventTarget,
      ev: CustomEvent<MediaLoadedInfo>,
    ) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    event: 'advanced-camera-card:media:unloaded',
    listener: (this: AdvancedCameraCardMediaLoadedEventTarget, ev: CustomEvent) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: 'advanced-camera-card:media:loaded',
    listener: (
      this: AdvancedCameraCardMediaLoadedEventTarget,
      ev: CustomEvent<MediaLoadedInfo>,
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    event: 'advanced-camera-card:media:unloaded',
    listener: (this: AdvancedCameraCardMediaLoadedEventTarget, ev: CustomEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}
