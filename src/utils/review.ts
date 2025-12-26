import { ViewItem } from '../view/item';

export interface CardMediaReviewEventTarget extends EventTarget {
  addEventListener(
    event: 'advanced-camera-card:media:reviewed',
    listener: (this: CardMediaReviewEventTarget, ev: CustomEvent<ViewItem>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: 'advanced-camera-card:media:reviewed',
    listener: (this: CardMediaReviewEventTarget, ev: CustomEvent<ViewItem>) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}
