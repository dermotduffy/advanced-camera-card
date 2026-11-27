import type { UnsubscribeCallback } from '../types.js';
import {
  sharedDocumentVisibility,
  type DocumentVisibility,
} from '../utils/document-visibility.js';

// The frontend's handler, a protected member of its players.
interface VisibilityHandlerHolder {
  _handleVisibilityChange?: unknown;
}

/**
 * Drive a Home Assistant camera player's own visibility handler from the card's
 * document visibility rather than from every `visibilitychange`.
 *
 * Home Assistant's players stop their stream as soon as the page is hidden in
 * the companion apps (frontend#55887), and start a new one when it is shown.
 * Android WebView hides the page for a moment while it enters fullscreen, so
 * the stream would restart; the card's visibility ignores that moment.
 *
 * Call after the player's own `connectedCallback`, which adds the listener this
 * replaces. Only a handler the player holds as its own function (as the
 * frontend does) is taken over; any other player is left as it is.
 */
export const drivePlayerVisibilityFromCard = (
  player: HTMLElement,
  documentVisibility: DocumentVisibility = sharedDocumentVisibility,
): UnsubscribeCallback | null => {
  const holder = player as unknown as VisibilityHandlerHolder;
  const handler = Object.prototype.hasOwnProperty.call(holder, '_handleVisibilityChange')
    ? holder._handleVisibilityChange
    : undefined;
  if (typeof handler !== 'function') {
    return null;
  }
  document.removeEventListener('visibilitychange', handler as EventListener);
  return documentVisibility.subscribe(() => handler());
};
