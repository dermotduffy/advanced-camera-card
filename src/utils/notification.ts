import { fireAdvancedCameraCardEvent } from './fire-advanced-camera-card-event.js';

export function dispatchDismissNotificationEvent(element: HTMLElement): void {
  fireAdvancedCameraCardEvent(element, 'notification:dismiss');
}
