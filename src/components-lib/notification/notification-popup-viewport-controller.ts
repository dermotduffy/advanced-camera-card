import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { getLayoutSize, isHTMLElement } from '../../utils/basic.js';
import { getShadowRootHost } from '../../utils/shadow-root.js';

const INSET_TOP_PROPERTY = '--notification-popup-inset-top';
const INSET_BOTTOM_PROPERTY = '--notification-popup-inset-bottom';

// Ensure the popup stays within the visible part of the card.
export class NotificationPopupViewportController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _resizeObserver = new ResizeObserver(() => this._update());

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    const container = this._getContainer();
    if (container) {
      this._resizeObserver.observe(container);
    }

    // Scroll events do not bubble, so the listener uses the capture phase to
    // observe scrolling in any element between the window and the container. A
    // Home Assistant dashboard scrolls an element within the page rather than
    // the window itself.
    window.addEventListener('scroll', this._update, { capture: true, passive: true });
    window.addEventListener('resize', this._update);

    this._update();
  }

  public hostDisconnected(): void {
    this._resizeObserver.disconnect();
    window.removeEventListener('scroll', this._update, { capture: true });
    window.removeEventListener('resize', this._update);
  }

  private _getContainer(): HTMLElement | null {
    const container = getShadowRootHost(this._host);
    return isHTMLElement(container) ? container : null;
  }

  private _update = (): void => {
    const container = this._getContainer();
    if (!container) {
      return;
    }

    const containerBox = container.getBoundingClientRect();
    const visibleTop = Math.max(containerBox.top, 0);
    const visibleBottom = Math.min(containerBox.bottom, window.innerHeight);

    if (visibleBottom <= visibleTop) {
      // No inset can bring the popup on screen when the container itself is
      // off screen, so the controller keeps the previous inset.
      return;
    }

    // The insets are measured on screen but applied in the container's own
    // pixels, which differ when an ancestor transform scales the container.
    const scale = containerBox.height / getLayoutSize(container).height;

    this._host.style.setProperty(
      INSET_TOP_PROPERTY,
      `${(visibleTop - containerBox.top) / scale}px`,
    );
    this._host.style.setProperty(
      INSET_BOTTOM_PROPERTY,
      `${(containerBox.bottom - visibleBottom) / scale}px`,
    );
  };
}
