import { noChange } from 'lit';
import {
  AttributePart,
  Directive,
  DirectiveParameters,
  directive,
} from 'lit/directive.js';
import { fireHASSEvent } from './ha/fire-hass-event.js';
import { ActionHandlerDetail, ActionHandlerOptions } from './ha/types.js';
import { stopEventFromActivatingCardWideActions } from './utils/action.js';
import { Timer } from './utils/timer.js';

interface ActionHandlerInterface extends HTMLElement {
  holdTime: number;
  bind(element: Element, options): void;
}
interface ActionHandlerElement extends HTMLElement {
  actionHandlerOptions?: AdvancedCameraCardActionHandlerOptions;
}

interface AdvancedCameraCardActionHandlerOptions extends ActionHandlerOptions {
  allowPropagation?: boolean;
}

class ActionHandler extends HTMLElement implements ActionHandlerInterface {
  public holdTime = 0.4;

  protected holdTimer = new Timer();
  protected doubleClickTimer = new Timer();

  protected held = false;
  protected started = false;

  public connectedCallback(): void {
    [
      'touchcancel',
      'mouseout',
      'mouseup',
      'touchmove',
      'mousewheel',
      'wheel',
      'scroll',
    ].forEach((ev) => {
      document.addEventListener(
        ev,
        () => {
          this.holdTimer.stop();
        },
        { passive: true },
      );
    });
  }

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
      const e = ev || window.event;
      if (e.preventDefault) {
        e.preventDefault();
      }
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.cancelBubble = true;
      e.returnValue = false;
      return false;
    });

    const start = (): void => {
      this.held = false;
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

      if (options?.hasHold && this.held) {
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
  const actionhandler: ActionHandler = getActionHandler();
  if (!actionhandler) {
    return;
  }
  actionhandler.bind(element, options);
};

export const actionHandler = directive(
  class extends Directive {
    update(part: AttributePart, [options]: DirectiveParameters<this>) {
      actionHandlerBind(part.element as ActionHandlerElement, options);
      return noChange;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    render(_options?: AdvancedCameraCardActionHandlerOptions) {}
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
