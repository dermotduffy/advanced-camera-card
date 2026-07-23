import type { MediaUnavailableIssueReason } from '../../../card-controller/issues/issues/media-unavailable';
import { fireAdvancedCameraCardEvent } from '../../../utils/fire-advanced-camera-card-event';

// What a provider knows about its own failure.
export interface LiveError {
  // The cause, drawn from the fixed set the card can describe and illustrate.
  // Absent when the provider cannot narrow it down, in which case the liveness
  // detector falls back to a generic playback error.
  reason?: MediaUnavailableIssueReason;

  // Free text naming the specific failure (e.g. "Failed to start WebRTC stream:
  // ..."). Absent when the provider has none.
  detail?: string;
}

declare global {
  interface HTMLElementEventMap {
    'advanced-camera-card:live:error': CustomEvent<LiveError>;
  }
}

export function dispatchLiveErrorEvent(element: EventTarget, error?: LiveError): void {
  fireAdvancedCameraCardEvent(element, 'live:error', error ?? {});
}
