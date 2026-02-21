/**
 * Determine if a card is in the editor.
 */
export const isCardInEditor = (card: HTMLElement): boolean => {
  const parent = card.getRootNode();
  return !!(
    parent &&
    parent instanceof ShadowRoot &&
    parent.host.localName === 'hui-card-preview'
  );
};
