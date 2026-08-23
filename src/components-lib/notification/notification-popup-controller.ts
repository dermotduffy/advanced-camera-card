import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { hasPopOutAnimationEnded } from '../../utils/animation.js';
import { dispatchDismissNotificationEvent } from '../../utils/notification.js';

// Manages the popup notification's modal interaction: dismiss on outside
// interaction or Escape, hold focus while it is shown, and emit the dismiss
// event once the pop-out animation finishes.
export class NotificationPopupController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _getNotificationElement: () => HTMLElement | null;
  private _elementFocusedBeforePopup: Element | null = null;
  private _hasTakenFocus = false;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    getNotificationElement: () => HTMLElement | null,
  ) {
    this._host = host;
    this._getNotificationElement = getNotificationElement;
    host.addController(this);
  }

  public hostConnected(): void {
    this._elementFocusedBeforePopup = document.activeElement;

    window.addEventListener('click', this._handleOutsideInteraction);
    window.addEventListener('focusin', this._handleOutsideInteraction);

    // Escape is claimed in the capture phase: the popup is a modal surface and
    // must consume Escape before non-modal background controls (e.g. the call
    // controls) that also listen on `window`.
    window.addEventListener('keydown', this._handleKeyDown, { capture: true });
  }

  public hostUpdated(): void {
    const notification = this._getNotificationElement();

    if (notification && !this._hasTakenFocus) {
      this._hasTakenFocus = true;
      notification.focus();
    }
  }

  public hostDisconnected(): void {
    window.removeEventListener('click', this._handleOutsideInteraction);
    window.removeEventListener('focusin', this._handleOutsideInteraction);
    window.removeEventListener('keydown', this._handleKeyDown, { capture: true });

    this._hasTakenFocus = false;

    // Focus returns to whatever held it before the popup appeared, unless
    // something else has taken focus since.
    if (
      this._elementFocusedBeforePopup instanceof HTMLElement &&
      document.activeElement === document.body
    ) {
      this._elementFocusedBeforePopup.focus();
    }
    this._elementFocusedBeforePopup = null;
  }

  public dismiss = (): void => {
    this._getNotificationElement()?.classList.add('exiting');
  };

  public handleAnimationEnd = (ev: AnimationEvent): void => {
    if (hasPopOutAnimationEnded(ev)) {
      dispatchDismissNotificationEvent(this._host);
    }
  };

  private _handleOutsideInteraction = (ev: Event): void => {
    if (!ev.composedPath().includes(this._host)) {
      this.dismiss();
    }
  };

  private _handleKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      this.dismiss();

      // `stopImmediatePropagation()` (not `stopPropagation()`) is required to
      // block sibling `window` listeners -- `stopPropagation()` only stops
      // propagation to other targets, not other listeners on `window` itself.
      ev.stopImmediatePropagation();
      ev.preventDefault();
    }
  };
}
