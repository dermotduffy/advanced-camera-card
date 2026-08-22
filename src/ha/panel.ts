import { getShadowRootHost } from '../utils/shadow-root';

/**
 * Determine if a card is in panel mode.
 */
export const isCardInPanel = (card: HTMLElement): boolean => {
  return getShadowRootHost(card)?.tagName === 'HUI-PANEL-VIEW';
};
