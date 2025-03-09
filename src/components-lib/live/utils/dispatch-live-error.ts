import { fireAdvancedCameraCardEvent } from '../../../utils/fire-advanced-camera-card-event';

export function dispatchLiveErrorEvent(element: EventTarget): void {
  fireAdvancedCameraCardEvent(element, 'live:error');
}
