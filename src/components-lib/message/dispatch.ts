import { AdvancedCameraCardError, Message } from '../../types';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';

// Facilitates correct typing of event handlers.
export interface AdvancedCameraCardMessageEventTarget extends EventTarget {
  addEventListener(
    event: 'advanced-camera-card:message',
    listener: (
      this: AdvancedCameraCardMessageEventTarget,
      ev: CustomEvent<Message>,
    ) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: 'advanced-camera-card:message',
    listener: (
      this: AdvancedCameraCardMessageEventTarget,
      ev: CustomEvent<Message>,
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

/**
 * Dispatch an event with an error message to show to the user. Calling this
 * method will grind the card to a halt, so should only be used for "global" /
 * critical errors (i.e. not for individual errors with a given camera, since
 * there may be multiple correctly functioning cameras in a grid).
 * @param element The element to send the event.
 * @param message The message to show.
 */
export const dispatchAdvancedCameraCardErrorEvent = (
  element: EventTarget,
  error: unknown,
): void => {
  if (error instanceof Error) {
    fireAdvancedCameraCardEvent<Message>(element, 'message', {
      message: error.message,
      type: 'error',
      ...(error instanceof AdvancedCameraCardError && { context: error.context }),
    });
  }
};
