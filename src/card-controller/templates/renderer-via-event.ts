import type { TemplateRenderer } from './index';

export class TemplateRendererGetEvent extends Event {
  public templateRenderer?: TemplateRenderer;

  constructor(eventInitDict?: EventInit) {
    super('advanced-camera-card:template-renderer:get', eventInitDict);
  }
}

/**
 * Fetch the card's TemplateRenderer by dispatching an event that bubbles up to
 * the card, which fills in the answer before the call returns. A last resort
 * for elements (e.g. `<advanced-camera-card-conditional>`) that may be nested
 * below DOM layers the card does not control and so cannot be handed the
 * renderer directly via a property.
 * @returns The TemplateRenderer, or null if nothing answered.
 */
export function getTemplateRendererViaEvent(
  element: HTMLElement,
): TemplateRenderer | null {
  const getEvent = new TemplateRendererGetEvent({
    bubbles: true,
    composed: true,
  });
  element.dispatchEvent(getEvent);
  return getEvent.templateRenderer ?? null;
}
