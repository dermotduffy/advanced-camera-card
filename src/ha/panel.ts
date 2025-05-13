/**
 * Determine if a card is in panel mode.
 */
export const isCardInPanel = (card: HTMLElement): boolean => {
  const parent = card.getRootNode();
  return !!(
    parent &&
    parent instanceof ShadowRoot &&
    parent.host.tagName === 'HUI-PANEL-VIEW'
  );
};
