import { ConditionStateManager } from './state-manager';

export class ConditionStateManagerGetEvent extends Event {
  public conditionStateManager?: ConditionStateManager;

  constructor(eventInitDict?: EventInit) {
    super('advanced-camera-card:condition-state-manager:get', eventInitDict);
  }
}

/**
 * Fetch the main ConditionStateManager via an event.
 * @returns The ConditionStateManager or null if not found.
 */

export function getConditionStateManagerViaEvent(
  element: HTMLElement,
): ConditionStateManager | null {
  const getEvent = new ConditionStateManagerGetEvent({
    bubbles: true,
    composed: true,
  });

  /* Special note on what's going on here:
   *
   * Some parts of the card (e.g. <advanced-camera-card-elements>) may have arbitrary
   * complexity and layers (that this card doesn't control) between that master
   * element and the element that needs to evaluate the condition. In these
   * cases there's no clean way to pass state from the rest of card down through
   * these layers. Instead, an event is dispatched as a "request for evaluation"
   * (ConditionEvaluateRequestEvent) upwards which is caught by the outer card
   * and the evaluation result is added to the event object. Because event
   * propagation is handled synchronously, the result will be added to the event
   * before the flow proceeds.
   */
  element.dispatchEvent(getEvent);
  return getEvent.conditionStateManager ?? null;
}
