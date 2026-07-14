import type { MediaUnavailableIssueReason } from '../../../card-controller/issues/issues/media-unavailable';
import { fireAdvancedCameraCardEvent } from '../../../utils/fire-advanced-camera-card-event';

declare global {
  interface HTMLElementEventMap {
    'advanced-camera-card:live:error': CustomEvent<
      MediaUnavailableIssueReason | undefined
    >;
  }
}

// The optional reason lets a provider that knows why it failed drive a specific
// media-unavailable message; absent, the liveness detector falls back to a
// generic playback error.
export function dispatchLiveErrorEvent(
  element: EventTarget,
  reason?: MediaUnavailableIssueReason,
): void {
  fireAdvancedCameraCardEvent(element, 'live:error', reason);
}
