import { ValidHassDomEvent } from './types';

/**
 * Fire an event has per Home Assistant frontend specifications. All events
 * fired by this method has expected content/behavior based on type.
 */
export const fireHASSEvent = <HassEvent extends ValidHassDomEvent>(
  target: EventTarget,
  type: HassEvent,
  detail?: HASSDomEvents[HassEvent],
  options?: {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
  },
) => {
  target.dispatchEvent(
    new CustomEvent<HASSDomEvents[HassEvent]>(type, {
      bubbles: options?.bubbles ?? true,
      composed: options?.composed ?? true,
      cancelable: options?.cancelable ?? false,
      detail: detail,
    }),
  );
};
