import { noChange } from 'lit';
import {
  Directive,
  directive,
  type AttributePart,
  type DirectiveParameters,
} from 'lit/directive.js';

import { ACTION_HANDLER_HOLD_SECONDS } from './const.js';
import { fireHASSEvent } from './ha/fire-hass-event.js';
import type { ActionHandlerDetail, ActionHandlerOptions } from './ha/types.js';
import { stopEventFromActivatingCardWideActions } from './utils/action.js';
import { isRecord, type Point } from './utils/basic.js';
import { Timer } from './utils/timer.js';

export interface ActionHandlerInterface extends HTMLElement {
  holdTime: number;
  connectedCallback(): void;
  bind(element: Element, options?: AdvancedCameraCardActionHandlerOptions): void;
}
interface ActionHandlerElement extends HTMLElement {
  actionHandlerOptions?: AdvancedCameraCardActionHandlerOptions;
}

export interface AdvancedCameraCardActionHandlerOptions extends ActionHandlerOptions {
  allowPropagation?: boolean;
}
// How far a pointer may travel before a press stops counting as a hold
// (example: a gallery is scrolled by dragging across the thumbnails, that also
// answer a hold -- a drag must answer the gallery, not the thumbnails).
const HOLD_MOVE_TOLERANCE_PIXELS = 10;

type PointerPosition = Pick<MouseEvent, 'clientX' | 'clientY'>;

const isPointerPosition = (value: unknown): value is PointerPosition =>
  isRecord(value) &&
  typeof value.clientX === 'number' &&
  typeof value.clientY === 'number';

// A mouse event holds `clientX` and `clientY` itself. A touch event holds no
// position of its own: it lists a `Touch` per finger, and the first one is the
// finger that began the press.
const getEventPoint = (ev: Event): Point | null => {
  const position = isPointerPosition(ev)
    ? ev
    : isRecord(ev) && isRecord(ev.touches) && isPointerPosition(ev.touches[0])
      ? ev.touches[0]
      : null;
  return position ? { x: position.clientX, y: position.clientY } : null;
};

class ActionHandler extends HTMLElement implements ActionHandlerInterface {
  public holdTime = ACTION_HANDLER_HOLD_SECONDS;

  private holdTimer = new Timer();
  private doubleClickTimer = new Timer();

  private held = false;
  private started = false;

  private holdOrigin: Point | null = null;

  public connectedCallback(): void {
    ['mouseup', 'mousewheel', 'scroll', 'touchcancel', 'wheel'].forEach((ev) => {
      document.addEventListener(
        ev,
        () => {
          this.holdTimer.stop();
        },
        { passive: true },
      );
    });
  }

  private _cancelHoldOnMove = (ev: Event): void => {
    const origin = this.holdOrigin;

    // Caution: this method is called on every move/touch over the element.
    // Nothing expensive should run before this.
    if (!origin) {
      return;
    }

    const point = getEventPoint(ev);
    if (
      point &&
      Math.hypot(point.x - origin.x, point.y - origin.y) > HOLD_MOVE_TOLERANCE_PIXELS
    ) {
      this.holdTimer.stop();
      this.held = false;
    }
  };

  public bind(
    element: ActionHandlerElement,
    options?: AdvancedCameraCardActionHandlerOptions,
  ): void {
    if (element.actionHandlerOptions) {
      // Reset the options on an existing actionHandler.
      element.actionHandlerOptions = options;
      return;
    }
    element.actionHandlerOptions = options;

    element.addEventListener('contextmenu', (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    });

    const start = (ev: Event): void => {
      this.held = false;
      this.holdOrigin = getEventPoint(ev);
      this.holdTimer.start(this.holdTime, () => {
        this.held = true;
      });

      // Without this check we get double start_tap events from touchstart and
      // mousedown events (on Android).
      if (!this.started) {
        this.started = true;
        fireHASSEvent(element, 'action', { action: 'start_tap' });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const endTap = (_ev: Event): void => {
      this.holdTimer.stop();
      this.holdOrigin = null;

      if (this.started) {
        this.started = false;
        fireHASSEvent(element, 'action', { action: 'end_tap' });
      }
    };

    const end = (ev: Event): void => {
      const options = element.actionHandlerOptions;
      if (!options?.allowPropagation) {
        // This will ensure only 1 actionHandler is invoked for a given interaction.
        stopEventFromActivatingCardWideActions(ev);
      }

      if (
        ['touchend', 'touchcancel'].includes(ev.type) &&
        // This action handler by default relies on synthetic click events for
        // touch devices, in order to ensure that embedded cards (e.g. WebRTC)
        // can use stock click handlers. The exception is for hold events.
        !this.held
      ) {
        return;
      }

      endTap(ev);

      const isKeyPress = ev instanceof KeyboardEvent;

      // A synthetic click (e.g. code calling `click()`) won't carry a
      // click-count detail. Synthetic clicks should not count for holds.
      const isSyntheticClick = ev instanceof MouseEvent && ev.detail === 0;

      if (options?.hasHold && this.held && !isKeyPress && !isSyntheticClick) {
        fireHASSEvent(element, 'action', { action: 'hold' });
      } else if (options?.hasDoubleClick) {
        if (
          (ev.type === 'click' && (ev as MouseEvent).detail < 2) ||
          !this.doubleClickTimer.isRunning()
        ) {
          this.doubleClickTimer.start(0.25, () =>
            fireHASSEvent(element, 'action', { action: 'tap' }),
          );
        } else {
          this.doubleClickTimer.stop();
          fireHASSEvent(element, 'action', { action: 'double_tap' });
        }
      } else {
        fireHASSEvent(element, 'action', { action: 'tap' });
      }
    };

    const handleEnter = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter') {
        end(ev);
      }
    };

    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', end);

    element.addEventListener('mousedown', start, { passive: true });
    element.addEventListener('click', end);

    element.addEventListener('keyup', handleEnter);

    // If the mouse leaves the element, this is considered the end of the interaction.
    element.addEventListener('mouseleave', endTap);

    element.addEventListener('mousemove', this._cancelHoldOnMove, { passive: true });
    element.addEventListener('touchmove', this._cancelHoldOnMove, { passive: true });
  }
}

customElements.define('action-handler-advanced-camera-card', ActionHandler);

const getActionHandler = (): ActionHandler => {
  const body = document.body;
  if (body.querySelector('action-handler-advanced-camera-card')) {
    return body.querySelector('action-handler-advanced-camera-card') as ActionHandler;
  }

  const actionhandler = document.createElement('action-handler-advanced-camera-card');
  body.appendChild(actionhandler);

  return actionhandler as ActionHandler;
};

const actionHandlerBind = (
  element: ActionHandlerElement,
  options?: AdvancedCameraCardActionHandlerOptions,
): void => {
  getActionHandler().bind(element, options);
};

export const actionHandler = directive(
  class extends Directive {
    update(part: AttributePart, [options]: DirectiveParameters<this>) {
      actionHandlerBind(part.element as ActionHandlerElement, options);
      return noChange;
    }

    // Required by Lit Directive API but never called (update() is used instead).
    // The start/stop form of the coverage hint is used because the `next` form
    // applies to whatever immediately follows the comment, which here is
    // another comment.
    /* v8 ignore start -- @preserve */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    render(_options?: AdvancedCameraCardActionHandlerOptions) {}
    /* v8 ignore stop -- @preserve */
  },
);

export interface ActionEventTarget extends EventTarget {
  addEventListener(
    event: '@action',
    listener: (this: ActionEventTarget, ev: CustomEvent<ActionHandlerDetail>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: '@action',
    listener: (this: ActionEventTarget, ev: CustomEvent<ActionHandlerDetail>) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'action-handler-advanced-camera-card': ActionHandler;
  }
  interface HASSDomEvents {
    action: ActionHandlerDetail;
  }
}
