import { OverlayMessage } from '../types.js';
import { fireAdvancedCameraCardEvent } from './fire-advanced-camera-card-event.js';

export function dispatchShowOverlayMessageEvent(
  element: HTMLElement,
  message: OverlayMessage,
): void {
  fireAdvancedCameraCardEvent(element, 'overlay-message:show', message);
}

export function dispatchDismissOverlayMessageEvent(element: HTMLElement): void {
  fireAdvancedCameraCardEvent(element, 'overlay-message:dismiss');
}
