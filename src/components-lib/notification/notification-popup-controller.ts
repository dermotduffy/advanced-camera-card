import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { hasPopOutAnimationEnded } from '../../utils/animation.js';
import { dispatchDismissNotificationEvent } from '../../utils/notification.js';

// Manages the popup notification's interaction: dismiss on outside interaction
// or Escape, hold focus while it is shown, and emit the dismiss event once the
// pop-out animation finishes.
export class NotificationPopupController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _getNotificationElement: () => HTMLElement | null;
  private _getFocusReturnElement: () => HTMLElement | null;
  private _hasTakenFocus = false;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    getNotificationElement: () => HTMLElement | null,
    getFocusReturnElement: () => HTMLElement | null,
  ) {
    this._host = host;
    this._getNotificationElement = getNotificationElement;
    this._getFocusReturnElement = getFocusReturnElement;
    host.addController(this);
  }

  public hostConnected(): void {
    window.addEventListener('click', this._handleOutsideInteraction);

    // Escape is claimed in the capture phase: the popup sits on top of the card
    // and must consume Escape before background controls (e.g. the call
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
    window.removeEventListener('keydown', this._handleKeyDown, { capture: true });

    this._hasTakenFocus = false;

    // The popup took focus when it appeared, so it hands focus back rather than
    // leaving the user with nothing in focus. Where focus returns is up to the
    // caller.
    //
    // Browser will decide whether or not to draw a focus ring. Don't use
    // `focusVisible: false` here since a user can dismiss the popup with the
    // keyboard, and `false` would then incorrectly take the focus ring away.
    const focusReturnElement = this._getFocusReturnElement();
    if (focusReturnElement && document.activeElement === document.body) {
      focusReturnElement.focus();
    }
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
