import {
  MediaLoadedCapabilities,
  MediaLoadedInfo,
  MediaPlayerController,
  MediaTechnology,
  UntargetedMediaLoadedInfo,
} from '../types.js';
import { fireAdvancedCameraCardEvent } from './fire-advanced-camera-card-event.js';

const MEDIA_INFO_HEIGHT_CUTOFF = 50;
const MEDIA_INFO_WIDTH_CUTOFF = MEDIA_INFO_HEIGHT_CUTOFF;

/**
 * Create a MediaLoadedInfo object. `targetID` is intentionally NOT an option
 * — it's owned by the source controller (`MediaLoadedInfoSourceController`)
 * and injected at dispatch time, so leaves don't have to (and can't) plumb
 * it through info construction.
 * @param source An event or HTMLElement that should be used as a source.
 * @returns A new info or null if one could not be created.
 */
export function createMediaLoadedInfo(
  source: Event | HTMLElement,
  options?: {
    mediaPlayerController?: MediaPlayerController;
    capabilities?: MediaLoadedCapabilities;
    technology?: MediaTechnology[];
  },
): UntargetedMediaLoadedInfo | null {
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
