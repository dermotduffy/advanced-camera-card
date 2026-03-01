import type { Handler } from '@use-gesture/vanilla';
import {
  createGesture,
  dragAction,
  pinchAction,
  wheelAction,
} from '@use-gesture/vanilla';
import { ReactiveController, ReactiveControllerHost } from 'lit';
import { dispatchActionExecutionRequest } from '../../card-controller/actions/utils/execution-request.js';
import {
  PTZAction,
  PTZActionPhase,
  PTZPanAction,
  PTZTiltAction,
  PTZZoomAction,
} from '../../config/schema/actions/custom/ptz.js';
import { createPTZAction } from '../../utils/action.js';

// Minimum drag distance (px) before the gesture is recognized as a drag.
const DRAG_THRESHOLD = 50;

// Drag distance (px) at which continuous PTZ start/stop begins. Below this
// threshold a single relative "nudge" is dispatched on release instead.
const CONTINUOUS_THRESHOLD = 100;

const CURSOR_GRAB = 'grab';
const CURSOR_GRABBING = 'grabbing';

export class PTZDragController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;

  // The DOM element gestures bind to. Distinct from _host because the host's
  // shadow DOM may contain siblings (e.g. PTZ overlay) that should not
  // receive gesture events.
  private _gestureElement: HTMLElement | null = null;

  // The @use-gesture Recognizer instance.
  private _gesture: ReturnType<ReturnType<typeof createGesture>> | null = null;

  // Whether gesture handling is active (triggers host re-render on change).
  private _active = false;

  // Currently running continuous pan/tilt directions.
  private _activeX: PTZPanAction | null = null;
  private _activeY: PTZTiltAction | null = null;

  // Whether the current drag has crossed CONTINUOUS_THRESHOLD and entered
  // continuous mode. Below that threshold, drag-end dispatches relative.
  private _continuous = false;

  // When a pinch occurs mid-drag, the drag is "poisoned" — all remaining
  // drag events for that gesture are ignored to prevent stray pan/tilt.
  private _dragCancelledByPinch = false;

  // Currently running continuous zoom (pinch).
  private _activeZoom: PTZZoomAction | null = null;

  // Original element styles restored on deactivate.
  private _savedTouchAction = '';
  private _savedCursor = '';

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    this._host.addController(this);
  }

  public hostDisconnected(): void {
    this.deactivateIfNecessary();
  }

  public activateIfNecessary(element: HTMLElement): void {
    if (this._active) {
      return;
    }

    this._gestureElement = element;
    this._applyGestureStyles(element);

    const gesture = createGesture([dragAction, pinchAction, wheelAction]);

    this._gesture = gesture(
      element,
      {
        onDrag: this._onDrag,
        onPinch: this._onPinch,
        onWheel: this._onWheel,
        onPointerDown: () => this._setCursor(true),
        onPointerUp: () => this._setCursor(false),
        onPointerLeave: () => this._setCursor(false),
        onPointerCancel: () => this._setCursor(false),
      },
      {
        drag: {
          threshold: DRAG_THRESHOLD,
          filterTaps: true,
        },
      },
    );

    this._active = true;
    this._host.requestUpdate();
  }

  public deactivateIfNecessary(): void {
    if (!this._active) {
      return;
    }

    this._gesture?.destroy();
    this._gesture = null;

    this._restoreGestureStyles();
    this._gestureElement = null;

    this._stopAllDirections();
    this._stopZoom();
    this._continuous = false;
    this._dragCancelledByPinch = false;

    this._active = false;
    this._host.requestUpdate();
  }

  private _applyGestureStyles(element: HTMLElement): void {
    this._savedCursor = element.style.cursor;
    this._savedTouchAction = element.style.touchAction;
    element.style.cursor = CURSOR_GRAB;
    element.style.touchAction = 'none';
  }

  private _restoreGestureStyles(): void {
    /* istanbul ignore next: only called when gesture is active -- @preserve */
    if (this._gestureElement) {
      this._gestureElement.style.cursor = this._savedCursor;
      this._gestureElement.style.touchAction = this._savedTouchAction;
    }
  }

  private _setCursor(grabbing: boolean): void {
    /* istanbul ignore next: only called when gesture is active -- @preserve  */
    if (this._gestureElement) {
      this._gestureElement.style.cursor = grabbing ? CURSOR_GRABBING : CURSOR_GRAB;
    }
  }

  private _onDrag: Handler<'drag'> = (state) => {
    if (state.pinching) {
      this._stopAllDirections();
      this._dragCancelledByPinch = true;
      return;
    }

    if (this._dragCancelledByPinch) {
      if (state.last) {
        this._dragCancelledByPinch = false;
      }
      return;
    }

    const [mx, my] = state.movement;

    if (state.last) {
      if (this._continuous) {
        this._stopAllDirections();
        this._continuous = false;
      } else {
        // Short drag: dispatch a single relative action per axis.
        this._dispatchRelative(mx, my);
      }
      return;
    }

    const distance = Math.sqrt(mx * mx + my * my);

    if (!this._continuous && distance >= CONTINUOUS_THRESHOLD) {
      this._continuous = true;
    }

    if (!this._continuous) {
      return;
    }

    // Inverted: dragging right sends PTZ left ("grab the scene").
    const wantX: PTZPanAction | null = mx > 0 ? 'left' : mx < 0 ? 'right' : null;
    const wantY: PTZTiltAction | null = my > 0 ? 'up' : my < 0 ? 'down' : null;

    if (wantX !== this._activeX) {
      if (this._activeX) {
        this._dispatch(this._activeX, 'stop');
      }
      this._activeX = wantX;
      if (wantX) {
        this._dispatch(wantX, 'start');
      }
    }

    if (wantY !== this._activeY) {
      if (this._activeY) {
        this._dispatch(this._activeY, 'stop');
      }
      this._activeY = wantY;
      if (wantY) {
        this._dispatch(wantY, 'start');
      }
    }
  };

  private _onPinch: Handler<'pinch'> = (state) => {
    const direction = state.direction[0];

    if (state.last) {
      this._stopZoom();
      return;
    }

    if (direction === 0) {
      return;
    }

    const action: PTZZoomAction = direction > 0 ? 'zoom_in' : 'zoom_out';

    if (action !== this._activeZoom) {
      this._stopZoom();
      this._activeZoom = action;
      this._dispatch(action, 'start');
    }
  };

  private _onWheel: Handler<'wheel'> = (state) => {
    // delta[1] is the vertical (Y-axis) scroll amount.
    const dy = state.delta[1];
    if (dy === 0) {
      return;
    }

    this._dispatch(dy > 0 ? 'zoom_out' : 'zoom_in');
  };

  private _dispatch(action: PTZAction | null, phase?: PTZActionPhase): void {
    /* istanbul ignore next: all call sites guard against this -- @preserve */
    if (!action) {
      return;
    }
    dispatchActionExecutionRequest(this._host, {
      actions: createPTZAction({
        ptzAction: action,
        ...(phase && { ptzPhase: phase }),
      }),
    });
  }

  // Dispatch relative actions from movement values. Inverted: positive X (drag
  // right) sends PTZ left.
  private _dispatchRelative(mx: number, my: number): void {
    if (mx > 0) {
      this._dispatch('left');
    } else if (mx < 0) {
      this._dispatch('right');
    }
    if (my > 0) {
      this._dispatch('up');
    } else if (my < 0) {
      this._dispatch('down');
    }
  }

  private _stopAllDirections(): void {
    if (this._activeX) {
      this._dispatch(this._activeX, 'stop');
      this._activeX = null;
    }
    if (this._activeY) {
      this._dispatch(this._activeY, 'stop');
      this._activeY = null;
    }
  }

  private _stopZoom(): void {
    if (!this._activeZoom) {
      return;
    }
    this._dispatch(this._activeZoom, 'stop');
    this._activeZoom = null;
  }
}
