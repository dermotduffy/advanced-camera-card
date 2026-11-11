import Panzoom, {
  type PanzoomEventDetail,
  type PanzoomObject,
} from '@dermotduffy/panzoom';
import { round, throttle } from 'lodash-es';

import {
  arefloatsApproximatelyEqual,
  isHoverableDevice,
  type Point,
} from '../../utils/basic';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';
import {
  isZoomEmpty,
  ZOOM_DEFAULT_PAN_X,
  ZOOM_DEFAULT_PAN_Y,
  ZOOM_DEFAULT_SCALE,
  ZOOM_PRECISION,
  type PartialZoomSettings,
  type ZoomSettingsObserved,
} from './types';

// A double tap (or double click) while zoomed is reported as `zoom:home`, on
// which the zoomer's host returns its target to the default zoom and pan
// through the same action as the `ptz_home` menu button and keyboard shortcut.
// While zoomed, every gesture is consumed to pan, so the card's own
// `double_tap_action` never sees one; this is the gesture to get back without
// pinching out. See:
// https://github.com/dermotduffy/advanced-camera-card/issues/2851
//
// A tap is a single pointer that comes up within TAP_MAX_MS, having moved at
// most TAP_MAX_MOVE_PX (more is a pan). Two taps make a double tap when the
// second starts within DOUBLE_TAP_MAX_MS of the end of the first (as Android's
// double-tap timeout) and ends within DOUBLE_TAP_MAX_DISTANCE_PX of it.
export const TAP_MAX_MS = 500;
export const TAP_MAX_MOVE_PX = 10;
export const DOUBLE_TAP_MAX_MS = 300;
export const DOUBLE_TAP_MAX_DISTANCE_PX = 40;

interface TapPoint {
  x: number;
  y: number;
  time: number;
}

export class ZoomController {
  private _element: HTMLElement;
  private _panzoom: PanzoomObject | null = null;

  // Is the controller zoomed in at all?
  private _zoomed = false;

  // Should clicks be allowed to propagate, or consumed as a pan/zoom action?
  private _allowClick = true;

  // The pointer that went down and may become a tap, and the last tap.
  private _tapStart: TapPoint | null = null;
  private _lastTap: TapPoint | null = null;

  // Whether zoom/pan gestures are active. When `false`, all gesture events pass
  // through untouched (used to yield to PTZ gesture mode).
  private _zoom = true;

  // Whether the user has zoomed/panned themselves. Panzoom holds a single
  // transform that both the card and the user write to, so the controller must
  // know whose values to maintain (e.g. in the event of a resize). A newly
  // supplied configuration supersedes the user.
  private _userAdjusted = false;

  // Where the user panned to in the percentages (to survive an element resize).
  // Unset at scale 1, where there is nothing to pan.
  private _userPan: Point | null = null;

  private _defaultSettings: PartialZoomSettings | null;
  private _settings: PartialZoomSettings | null;

  // These values should be suitably less than the value of STEP_DELAY_SECONDS
  // in the ptz_digital action, in order to ensure smooth movements of the
  // digital PTZ actions.
  private _debouncedChangeHandler = throttle(this._changeHandler.bind(this), 50);
  private _debouncedUpdater = throttle(this._updateBasedOnConfig.bind(this), 50);

  // A resize changes the element size that pan percentages are measured
  // against, so the pan is re-derived at the new size (from the card's
  // percentages or the user's depending on who moved last).
  private _debouncedResizeUpdater = throttle(() => {
    const panzoom = this._panzoom;
    if (!panzoom) {
      return;
    }

    if (this._userAdjusted) {
      this._updateBasedOnUserPan(panzoom);
    } else {
      this._updateBasedOnConfig();
    }
  }, 50);

  private _resizeObserver = new ResizeObserver(this._debouncedResizeUpdater);

  private _events = isHoverableDevice()
    ? {
        down: ['pointerdown'],
        move: ['pointermove'],
        up: ['pointerup', 'pointerleave', 'pointercancel'],
      }
    : {
        down: ['touchstart'],
        move: ['touchmove'],
        up: ['touchend', 'touchcancel'],
      };

  private _downHandler = (ev: Event) => {
    if (this._shouldZoomOrPan(ev)) {
      this._tapStart = this._getTapPoint(ev);
      this._panzoom?.handleDown(ev as PointerEvent);
      ev.stopPropagation();

      // If we do not prevent default here, the media carousels scroll.
      ev.preventDefault();
      this._allowClick = false;
    } else {
      this._allowClick = true;
    }
  };

  private _clickHandler = (ev: Event) => {
    // When mouse clicking is used to pan, need to avoid that causing a click
    // handler elsewhere in the card being called. Example: Viewing a snapshot,
    // and panning within it should not cause a related clip to play (the click
    // handler in the viewer).
    if (!this._allowClick) {
      ev.stopPropagation();
    }
    this._allowClick = true;
  };

  private _moveHandler = (ev: Event) => {
    if (this._shouldZoomOrPan(ev)) {
      this._panzoom?.handleMove(ev as PointerEvent);
      ev.stopPropagation();
    }
  };

  private _upHandler = (ev: Event) => {
    if (this._shouldZoomOrPan(ev)) {
      this._panzoom?.handleUp(ev as PointerEvent);
      ev.stopPropagation();
      this._handleTap(ev);
    }
  };

  private _wheelHandler = (ev: Event) => {
    if (ev instanceof WheelEvent && this._shouldZoomOrPan(ev)) {
      this._panzoom?.zoomWithWheel(ev);
      ev.stopPropagation();
    }
  };

  constructor(
    element: HTMLElement,
    options?: {
      config?: PartialZoomSettings | null;
      defaultConfig?: PartialZoomSettings | null;
    },
  ) {
    this._element = element;
    this._settings = options?.config ?? null;
    this._defaultSettings = options?.defaultConfig ?? null;
  }

  public activate(): void {
    // Panzoom throws if it is constructed against an element that is not
    // attached to the DOM.
    if (!this._element.isConnected) {
      return;
    }

    const config = this._getConfigToUse();
    const converted = this._convertPercentToXYPan(
      config?.pan?.x ?? ZOOM_DEFAULT_PAN_X,
      config?.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
      config?.zoom ?? ZOOM_DEFAULT_SCALE,
    );

    const startScale = config?.zoom ?? ZOOM_DEFAULT_SCALE;

    this._panzoom = Panzoom(this._element, {
      contain: 'outside',
      maxScale: 10,
      minScale: 1,
      noBind: true,
      // Do not force the cursor style (by default it will always show the
      // 'move' type cursor whether or not it is zoomed in).
      cursor: undefined,

      // Disable automatic touchAction setting from Panzoom() as otherwise it
      // effectively disables dashboard scrolling. See:
      // https://github.com/dermotduffy/advanced-camera-card/issues/1181
      touchAction: '',

      // Set the initial pan/zoom values to avoid an initial unzoomed view.
      ...(config && converted && { startX: converted.x }),
      ...(config && converted && { startY: converted.y }),
      ...(config && converted && { startScale }),
    });

    const registerListeners = (
      events: string[],
      func: (ev: Event) => void,
      options?: AddEventListenerOptions,
    ) => {
      events.forEach((eventName) => {
        this._element.addEventListener(eventName, func, options);
      });
    };

    registerListeners(this._events['down'], this._downHandler, { capture: true });
    registerListeners(this._events['move'], this._moveHandler, { capture: true });
    registerListeners(this._events['up'], this._upHandler, { capture: true });
    registerListeners(['wheel'], this._wheelHandler);
    registerListeners(['click'], this._clickHandler, { capture: true });

    this._resizeObserver.observe(this._element);
    this._element.addEventListener('panzoomchange', this._debouncedChangeHandler);
  }

  public deactivate(): void {
    const unregisterListener = (
      events: string[],
      func: (ev: Event) => void,
      options?: EventListenerOptions,
    ) => {
      events.forEach((eventName) => {
        this._element.removeEventListener(eventName, func, options);
      });
    };

    unregisterListener(this._events['down'], this._downHandler, { capture: true });
    unregisterListener(this._events['move'], this._moveHandler, { capture: true });
    unregisterListener(this._events['up'], this._upHandler, { capture: true });
    unregisterListener(['wheel'], this._wheelHandler);
    unregisterListener(['click'], this._clickHandler, { capture: true });

    this._resizeObserver.disconnect();
    this._element.removeEventListener('panzoomchange', this._debouncedChangeHandler);

    this._clearUserAdjustment();
    this._panzoom = null;
  }

  public setDefaultSettings(config: PartialZoomSettings | null): void {
    this._defaultSettings = config;
    this._clearUserAdjustment();
    this._debouncedUpdater();
  }

  public setSettings(config: PartialZoomSettings | null): void {
    this._settings = config;
    this._clearUserAdjustment();
    this._debouncedUpdater();
  }

  public isActivated(): boolean {
    return !!this._panzoom;
  }

  public setZoom(value: boolean): void {
    this._zoom = value;
  }

  private _changeHandler(ev: Event): void {
    const pz = (<CustomEvent<PanzoomEventDetail>>ev).detail;
    const unzoomed = this._isUnzoomed(pz.scale);

    // Take care here to only dispatch the zoomed/unzoomed events when the
    // absolute state changes (rather than on every single zoom adjustment).
    if (unzoomed && this._zoomed) {
      this._zoomed = false;
      this._setTouchAction(true);
      fireAdvancedCameraCardEvent(this._element, 'zoom:unzoomed');
    } else if (!unzoomed && !this._zoomed) {
      this._zoomed = true;
      this._setTouchAction(false);
      fireAdvancedCameraCardEvent(this._element, 'zoom:zoomed');
    }

    const converted = this._convertXYPanToPercent(pz.x, pz.y, pz.scale);

    // Panzoom sets originalEvent only for a change that a gesture drove.
    if (pz.originalEvent) {
      this._userAdjusted = true;

      if (converted) {
        this._userPan = converted;
      }
    }

    const observed: ZoomSettingsObserved = {
      pan: {
        x: converted?.x ?? ZOOM_DEFAULT_PAN_X,
        y: converted?.y ?? ZOOM_DEFAULT_PAN_Y,
      },
      zoom: pz.scale,
      isDefault: this._isAtDefaultZoomAndPan(pz.x, pz.y, pz.scale),
      unzoomed: unzoomed,
    };

    fireAdvancedCameraCardEvent(this._element, 'zoom:change', observed);
  }

  private _isZoomEqual(a: PartialZoomSettings, b: PartialZoomSettings): boolean {
    // The ?? clauses below cannot be reached since this function is only ever
    // used fully specified by this object. It's kept as-is for completeness.
    return (
      arefloatsApproximatelyEqual(
        a.zoom ?? ZOOM_DEFAULT_SCALE,
        b.zoom ?? ZOOM_DEFAULT_SCALE,
        ZOOM_PRECISION,
      ) &&
      arefloatsApproximatelyEqual(
        a.pan?.x ?? ZOOM_DEFAULT_PAN_X,
        b.pan?.x ?? ZOOM_DEFAULT_PAN_X,
        ZOOM_PRECISION,
      ) &&
      arefloatsApproximatelyEqual(
        /* v8 ignore next @preserve */
        a.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
        /* v8 ignore next @preserve */
        b.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
        ZOOM_PRECISION,
      )
    );
  }

  private _getConfigToUse(): PartialZoomSettings | null {
    return isZoomEmpty(this._settings) ? this._defaultSettings : this._settings;
  }

  private _clearUserAdjustment(): void {
    this._userAdjusted = false;
    this._userPan = null;
  }

  // Re-derives the user's pan for the current element size, at the scale they
  // chose (panzoom's scale does not depend on the element size, so that is left
  // untouched).
  private _updateBasedOnUserPan(panzoom: PanzoomObject): void {
    if (!this._userPan) {
      return;
    }

    const converted = this._convertPercentToXYPan(
      this._userPan.x,
      this._userPan.y,
      panzoom.getScale(),
    );
    if (!converted) {
      return;
    }

    panzoom.pan(converted.x, converted.y, { animate: false });
  }

  private _updateBasedOnConfig(): void {
    const panzoom = this._panzoom;
    if (!panzoom) {
      return;
    }

    // Applying the configuration before layout has sized the element would zoom
    // at dead center. The resize that follows layout applies it in full.
    if (!this._hasSize()) {
      return;
    }

    const config = this._getConfigToUse();
    const desiredScale = config?.zoom ?? ZOOM_DEFAULT_SCALE;

    // Transform won't exist (will be null) if the desired scale has no zoom
    // (i.e. is 1), in which case there is nothing to pan and dead center is
    // correct.
    const converted = this._convertPercentToXYPan(
      config?.pan?.x ?? ZOOM_DEFAULT_PAN_X,
      config?.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
      desiredScale,
    );

    const x = converted?.x ?? 0;
    const y = converted?.y ?? 0;

    // Verify there is a material change in the pan/zoom settings before acting.
    if (
      this._isZoomEqual(
        { zoom: desiredScale, pan: { x: x, y: y } },
        {
          zoom: panzoom.getScale(),
          pan: panzoom.getPan(),
        },
      )
    ) {
      return;
    }

    panzoom.zoom(desiredScale, {
      // Zoom is stepped, not animated. If it is animated, there is interaction
      // between the zoom and the pan below, and the pan would need to be
      // delayed until after the zoom is complete.
      animate: false,
    });

    // Panzoom must allow the browser to paint the zoomed image in order to
    // "contain" the pan within the parent, this creates somewhat of an async
    // situation where we need to ensure the zoom completes first. Using
    // `requestAnimationFrame` appears to reliably allow the zoom to finish
    // rendering first, before the pan is applied.
    //
    // See: https://github.com/timmywil/panzoom?tab=readme-ov-file#a-note-on-the-async-nature-of-panzoom
    window.requestAnimationFrame(() => {
      // Protect against deactivation.
      if (this._panzoom !== panzoom) {
        return;
      }

      panzoom.pan(x, y, {
        animate: true,
        duration: 100,

        // An explicit undefined overrides the `contain: 'outside'` the instance
        // was constructed with, turning containment off for just this one pan.
        // Panzoom measures the element to decide how far it may pan, and on a
        // slow device the browser may not have applied the zoom transform yet,
        // so it would measure the unzoomed box and clamp this pan back toward
        // center. `_convertPercentToXYPan` already keeps these coordinates
        // within the range the desired scale allows, so nothing is lost.
        contain: undefined,
      });
    });
  }

  /**
   * Convert from Advanced Camera Card pan % values to Panzoom X/Y transformation
   * coordinates.
   * @param x The x translation value.
   * @param y The y translation value.
   * @param scale The desired (not current) scale.
   * @returns An object with x/y pan % values or null on error.
   */
  private _convertPercentToXYPan(x: number, y: number, scale: number): Point | null {
    const minMax = this._getTransformMinMax(scale);
    if (minMax === null) {
      return null;
    }

    return {
      x: minMax.minX + (minMax.maxX - minMax.minX) * (x / 100),
      y: minMax.minY + (minMax.maxY - minMax.minY) * (y / 100),
    };
  }

  private _convertXYPanToPercent(x: number, y: number, scale: number): Point | null {
    const minMax = this._getTransformMinMax(scale);
    if (minMax === null) {
      return null;
    }

    return {
      x:
        ((-x + Math.abs(minMax.minX)) /
          (Math.abs(minMax.maxX) + Math.abs(minMax.minX))) *
        100,
      y:
        ((-y + Math.abs(minMax.minY)) /
          (Math.abs(minMax.maxY) + Math.abs(minMax.minY))) *
        100,
    };
  }

  private _getTransformMinMax(scale: number): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null {
    if (!this._hasSize()) {
      return null;
    }

    const size = this._getLayoutSize();

    const minX = (size.width * (scale - 1)) / scale / 2;
    const minY = (size.height * (scale - 1)) / scale / 2;

    if (arefloatsApproximatelyEqual(minX, 0) || arefloatsApproximatelyEqual(minY, 0)) {
      return null;
    }

    return {
      minX: minX,
      maxX: -minX,
      minY: minY,
      maxY: -minY,
    };
  }

  private _hasSize(): boolean {
    const size = this._getLayoutSize();
    return !!size.width && !!size.height;
  }

  // The element's size excluding any transform (`getBoundingClientRect()`
  // includes the Panzoom transform).
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2223
  private _getLayoutSize(): { width: number; height: number } {
    return {
      width: this._element.offsetWidth,
      height: this._element.offsetHeight,
    };
  }

  private _isUnzoomed(scale?: number): boolean {
    return scale !== undefined && round(scale, ZOOM_PRECISION) <= 1;
  }

  private _isAtDefaultZoomAndPan(x: number, y: number, scale: number): boolean {
    if (!this._defaultSettings) {
      return this._isUnzoomed(scale);
    }

    const convertedDefault = this._convertPercentToXYPan(
      this._defaultSettings.pan?.x ?? ZOOM_DEFAULT_PAN_X,
      this._defaultSettings.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
      this._defaultSettings.zoom ?? ZOOM_DEFAULT_SCALE,
    );
    if (!convertedDefault) {
      return true;
    }

    // The ZOOM_DEFAULT_SCALE fallback cannot be reached: when
    // this._defaultSettings.zoom is undefined, convertedDefault ends up null
    // above and this function has already returned.
    /* v8 ignore next @preserve */
    const defaultScale = this._defaultSettings.zoom ?? ZOOM_DEFAULT_SCALE;

    return (
      arefloatsApproximatelyEqual(x, convertedDefault.x) &&
      arefloatsApproximatelyEqual(y, convertedDefault.y) &&
      arefloatsApproximatelyEqual(scale, defaultScale)
    );
  }

  /**
   * Where and when a single pointer is, or null for none or more than one
   * (a pinch is never a tap).
   */
  private _getTapPoint(ev: Event): TapPoint | null {
    let point: { clientX: number; clientY: number } | undefined;
    if (window.TouchEvent && ev instanceof TouchEvent) {
      const touches = ev.type === 'touchstart' ? ev.touches : ev.changedTouches;
      point = touches.length === 1 ? touches[0] : undefined;
    } else if (ev instanceof MouseEvent) {
      point = ev;
    }
    return point ? { x: point.clientX, y: point.clientY, time: ev.timeStamp } : null;
  }

  private _handleTap(ev: Event): void {
    const start = this._tapStart;
    this._tapStart = null;

    // A leave or cancel only drops the press in progress: a touch on a
    // hoverable device also fires pointerleave right after its pointerup.
    if (!['pointerup', 'touchend'].includes(ev.type)) {
      return;
    }

    const end = this._getTapPoint(ev);
    const isTap =
      !!start &&
      !!end &&
      end.time - start.time <= TAP_MAX_MS &&
      Math.hypot(end.x - start.x, end.y - start.y) <= TAP_MAX_MOVE_PX;

    if (!isTap) {
      this._lastTap = null;
      return;
    }

    const last = this._lastTap;
    if (
      last &&
      start.time - last.time <= DOUBLE_TAP_MAX_MS &&
      Math.hypot(end.x - last.x, end.y - last.y) <= DOUBLE_TAP_MAX_DISTANCE_PX
    ) {
      this._lastTap = null;
      fireAdvancedCameraCardEvent(this._element, 'zoom:home');
    } else {
      this._lastTap = end;
    }
  }

  private _shouldZoomOrPan(ev: Event): boolean {
    if (!this._zoom) {
      return false;
    }
    return (
      !this._isUnzoomed(this._panzoom?.getScale()) ||
      // TouchEvent does not exist on Firefox on non-touch events. See:
      // https://github.com/dermotduffy/advanced-camera-card/issues/1174
      (window.TouchEvent && ev instanceof TouchEvent && ev.touches.length > 1) ||
      (ev instanceof WheelEvent && ev.ctrlKey)
    );
  }

  private _setTouchAction(touchEnabled: boolean): void {
    this._element.style.touchAction = touchEnabled ? '' : 'none';
  }
}
