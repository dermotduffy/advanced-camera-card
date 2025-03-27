import { fireAdvancedCameraCardEvent } from '../../../utils/fire-advanced-camera-card-event';
import { ActionsExecutionRequest } from '../types';

export const dispatchActionExecutionRequest = (
  element: HTMLElement,
  request: ActionsExecutionRequest,
) => {
  fireAdvancedCameraCardEvent(element, 'action:execution-request', request);
};

export interface ActionExecutionRequestEventTarget extends EventTarget {
  addEventListener(
    event: 'advanced-camera-card:action:execution-request',
    listener: (
      this: ActionExecutionRequestEventTarget,
      ev: CustomEvent<ActionsExecutionRequest>,
    ) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: 'advanced-camera-card:action:execution-request',
    listener: (
      this: ActionExecutionRequestEventTarget,
      ev: CustomEvent<ActionsExecutionRequest>,
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}
