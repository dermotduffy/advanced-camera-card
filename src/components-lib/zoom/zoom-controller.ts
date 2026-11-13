import Panzoom, {
  type PanzoomEventDetail,
  type PanzoomObject,
} from '@dermotduffy/panzoom';
import { round, throttle } from 'lodash-es';

import type { CameraDimensionsConfig } from '../../config/schema/cameras';
import {
  DOUBLE_TAP_PIXELS,
  DOUBLE_TAP_SECONDS,
  DRAG_THRESHOLD_PIXELS,
  HOLD_SECONDS,
} from '../../const';
import type { MediaLoadedInfoEventDetail } from '../../types';
import { onAbort } from '../../utils/abort-signal';
import {
  arefloatsApproximatelyEqual,
  getDistance,
  getLayoutSize,
  isHoverableDevice,
  type Point,
  type Size,
} from '../../utils/basic';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';
import { isMediaContainedAndCentered } from '../../utils/media-layout';
import { zoomStore, type ZoomStore } from '../../utils/zoom-store';
import {
  isZoomEmpty,
  ZOOM_DEFAULT_PAN_X,
  ZOOM_DEFAULT_PAN_Y,
  ZOOM_DEFAULT_SCALE,
  ZOOM_PRECISION,
  type PartialZoomSettings,
  type ZoomSettingsBase,
  type ZoomSettingsObserved,
} from './types';

// Touch behavior while unzoomed: the browser may pan the page over unzoomed
// media, but not zoom it.
const UNZOOMED_TOUCH_ACTION = 'pan-x pan-y';

interface TapPoint extends Point {
  time: number;
}

// A tap is one pointer going down and up again before it becomes a hold,
// without moving far enough to become a drag.
const isTap = (start: TapPoint, end: TapPoint): boolean =>
  end.time - start.time < HOLD_SECONDS * 1000 &&
  getDistance(start, end) <= DRAG_THRESHOLD_PIXELS;

const isDoubleTap = (first: TapPoint, second: TapPoint): boolean =>
  second.time - first.time <= DOUBLE_TAP_SECONDS * 1000 &&
  getDistance(first, second) <= DOUBLE_TAP_PIXELS;

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

  // The width/height ratio of the loaded media, and the signal that retires it.
  private _mediaAspectRatio: number | null = null;
  private _mediaSignal: AbortSignal | null = null;

  private _dimensionsConfig: CameraDimensionsConfig | null = null;

  // The width/height ratio of the picture contained and centered within the
  // element, or null when the element itself bounds the pan.
  private _pictureAspectRatio: number | null = null;

  private _defaultSettings: PartialZoomSettings | null;
  private _settings: PartialZoomSettings | null;

  // Where to start when nothing is requested: the zoom the target was last
  // seen at before a remount (see `setStartSettings`). Ahead of the default,
  // dropped by any request or a new default.
  private _startSettings: ZoomSettingsBase | null = null;

  // The page-wide store of each camera's last zoom (see `setStoreKey`), and
  // whether this instance put a zoom there or started from one (only then does
  // a return to the default forget it, so that another card loading the same
  // camera does not).
  private _store: ZoomStore;
  private _storeKey: string | null = null;
  private _stored = false;

  // These values should be suitably less than the value of STEP_DELAY_SECONDS
  // in the ptz_digital action, in order to ensure smooth movements of the
  // digital PTZ actions.
  private _debouncedChangeHandler = throttle(this._changeHandler.bind(this), 50);
  private _debouncedUpdater = throttle(this._updateBasedOnConfig.bind(this), 50);

  // A resize, or a new picture shape, changes the size that pan percentages
  // are measured against, so the pan is re-derived at the new size (from the
  // card's percentages or the user's depending on who moved last).
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
    const panzoom = this._panzoom;
    if (panzoom && this._shouldZoomOrPan(ev)) {
      panzoom.handleMove(ev as PointerEvent);
      this._contain(panzoom);
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
    const panzoom = this._panzoom;
    if (panzoom && ev instanceof WheelEvent && this._shouldZoomOrPan(ev)) {
      panzoom.zoomWithWheel(ev);
      this._contain(panzoom);
      ev.stopPropagation();
    }
  };

  private _mediaLoadedHandler = (ev: CustomEvent<MediaLoadedInfoEventDetail>): void => {
    const { info, signal } = ev.detail;
    this._mediaAspectRatio = info.width && info.height ? info.width / info.height : null;
    this._mediaSignal = signal;
    onAbort(signal, () => {
      // A later load may already have replaced this one.
      if (this._mediaSignal === signal) {
        this._mediaAspectRatio = null;
        this._mediaSignal = null;
        this._updatePictureAspectRatio();
      }
    });
    this._updatePictureAspectRatio();
  };

  constructor(
    element: HTMLElement,
    options?: {
      config?: PartialZoomSettings | null;
      defaultConfig?: PartialZoomSettings | null;
      store?: ZoomStore;
    },
  ) {
    this._element = element;
    this._store = options?.store ?? zoomStore;
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

    // Panzoom's own containment ('contain' parameter) is turned off: it can
    // only keep the pan within the element, not within the picture inside it
    // (see `_contain`).
    this._panzoom = Panzoom(this._element, {
      maxScale: 10,
      minScale: 1,
      noBind: true,
      // Do not force the cursor style (by default it will always show the
      // 'move' type cursor whether or not it is zoomed in).
      cursor: undefined,

      // Panzoom's default of `none` would stop the dashboard scrolling, see:
      // https://github.com/dermotduffy/advanced-camera-card/issues/1181
      touchAction: UNZOOMED_TOUCH_ACTION,

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
    this._element.addEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadedHandler,
    );

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
    this._element.removeEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadedHandler,
    );

    this._resizeObserver.disconnect();
    this._element.removeEventListener('panzoomchange', this._debouncedChangeHandler);

    this._clearUserAdjustment();
    this._panzoom = null;
  }

  public setDefaultSettings(config: PartialZoomSettings | null): void {
    this._defaultSettings = config;
    this._startSettings = null;
    this._clearUserAdjustment();
    this._debouncedUpdater();
  }

  public setSettings(config: PartialZoomSettings | null): void {
    this._settings = config;

    // Any request supersedes the start: also an empty one, which returns to
    // the default (a double tap, the `ptz_home` button or the `h` key).
    this._startSettings = null;
    this._clearUserAdjustment();
    this._debouncedUpdater();
  }

  public setDimensionsConfig(dimensionsConfig: CameraDimensionsConfig | null): void {
    this._dimensionsConfig = dimensionsConfig;
    this._updatePictureAspectRatio();
  }

  /**
   * Keep this target's zoom in the page-wide store under `key` (null: not at
   * all), to start from when nothing else says where (see `setStartSettings`).
   */
  public setStoreKey(key: string | null): void {
    this._storeKey = key;
    this._stored = false;
  }

  /**
   * Start from the zoom the target was last seen at in this card, unless that
   * was its default; without one, from the store. Set before activation.
   */
  public setStartSettings(observed: ZoomSettingsObserved | null): void {
    const start = observed
      ? observed.isDefault
        ? null
        : observed
      : this._storeKey
        ? this._store.get(this._storeKey)
        : null;
    this._startSettings = start ? { zoom: start.zoom, pan: { ...start.pan } } : null;

    // Starting from it, this instance shows the stored zoom: a return to the
    // default here forgets it, even before this instance reports a zoom (the
    // start may need no change to apply, and so report nothing).
    if (start) {
      this._stored = true;
    }
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

    // Panzoom reports a gesture step before `_contain` keeps it within limits.
    const pan = this._clampPan({ x: pz.x, y: pz.y }, pz.scale);
    const converted = this._convertXYPanToPercent(pan.x, pan.y, pz.scale);

    // Panzoom sets originalEvent only for a change that a gesture drove.
    if (pz.originalEvent) {
      this._userAdjusted = true;

      // A gesture cannot move the picture along an axis without room, so the
      // user's earlier pan on that axis is kept.
      const minMax = this._getTransformMinMax(pz.scale);
      if (converted && minMax) {
        const previous = this._userPan ?? converted;
        this._userPan = {
          x: arefloatsApproximatelyEqual(minMax.minX, 0) ? previous.x : converted.x,
          y: arefloatsApproximatelyEqual(minMax.minY, 0) ? previous.y : converted.y,
        };
      }
    }

    const observed: ZoomSettingsObserved = {
      pan: {
        x: converted?.x ?? ZOOM_DEFAULT_PAN_X,
        y: converted?.y ?? ZOOM_DEFAULT_PAN_Y,
      },
      zoom: pz.scale,
      isDefault: this._isAtDefaultZoomAndPan(pan.x, pan.y, pz.scale),
      unzoomed: unzoomed,
    };

    if (this._storeKey && (!observed.isDefault || this._stored)) {
      this._store.set(this._storeKey, observed.isDefault ? null : observed);
      this._stored = !observed.isDefault;
    }

    fireAdvancedCameraCardEvent(this._element, 'zoom:change', observed);
  }

  private _isZoomEqual(a: PartialZoomSettings, b: PartialZoomSettings): boolean {
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
      // The ?? clauses below cannot be reached since this function is only ever
      // used fully specified by this object. It's kept as-is for completeness.
      arefloatsApproximatelyEqual(
        /* v8 ignore next: the fallback cannot be reached, see above -- @preserve */
        a.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
        /* v8 ignore next: the fallback cannot be reached, see above -- @preserve */
        b.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
        ZOOM_PRECISION,
      )
    );
  }

  // A requested zoom, else the one to start from, else the default.
  private _getConfigToUse(): PartialZoomSettings | null {
    if (!isZoomEmpty(this._settings)) {
      return this._settings;
    }
    return this._startSettings ?? this._defaultSettings;
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
    this._contain(panzoom);

    // The controller requests the pan a frame later so that the zoom steps
    // rather than animates: Panzoom writes each change on the next animation
    // frame, and the browser animates a zoom written in the same frame as an
    // animated pan.
    window.requestAnimationFrame(() => {
      // Protect against deactivation.
      if (this._panzoom !== panzoom) {
        return;
      }

      panzoom.pan(x, y, {
        animate: true,
        duration: 100,
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

    // An axis without room to pan is centered.
    const toPercent = (value: number, min: number): number =>
      arefloatsApproximatelyEqual(min, 0) ? 50 : ((-value + min) / (2 * min)) * 100;

    return {
      x: toPercent(x, minMax.minX),
      y: toPercent(y, minMax.minY),
    };
  }

  private _updatePictureAspectRatio(): void {
    const ratio = isMediaContainedAndCentered(this._dimensionsConfig)
      ? this._mediaAspectRatio
      : null;
    if (ratio === this._pictureAspectRatio) {
      return;
    }
    this._pictureAspectRatio = ratio;
    this._debouncedResizeUpdater();
  }

  // The picture's size at scale 1, contained within the element.
  private _getPictureSize(): Size {
    const size = getLayoutSize(this._element);
    const ratio = this._pictureAspectRatio;
    if (!ratio) {
      return size;
    }
    return size.width / size.height > ratio
      ? { width: size.height * ratio, height: size.height }
      : { width: size.width, height: size.width / ratio };
  }

  private _clampPan(pan: Point, scale: number): Point {
    const minMax = this._getTransformMinMax(scale);

    // An axis without room is centered (0, never -0).
    const clamp = (value: number, limit: number): number =>
      limit ? Math.min(limit, Math.max(-limit, value)) : 0;

    return minMax
      ? { x: clamp(pan.x, minMax.minX), y: clamp(pan.y, minMax.minY) }
      : { x: 0, y: 0 };
  }

  // Keeps the pan that Panzoom just set within the limits. Called after every
  // Panzoom call that can move the pan.
  private _contain(panzoom: PanzoomObject): void {
    const pan = panzoom.getPan();
    const contained = this._clampPan(pan, panzoom.getScale());
    if (contained.x !== pan.x || contained.y !== pan.y) {
      // Silent, so that Panzoom's report of the step itself, which carries the
      // gesture that drove it, is the last report of that step.
      panzoom.pan(contained.x, contained.y, { animate: false, silent: true });
    }
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

    // The room to pan on each axis is how far the scaled picture overhangs the
    // element, in Panzoom's unscaled coordinates.
    const size = getLayoutSize(this._element);
    const picture = this._getPictureSize();

    const minX = Math.max(0, (picture.width - size.width / scale) / 2);
    const minY = Math.max(0, (picture.height - size.height / scale) / 2);

    if (arefloatsApproximatelyEqual(minX, 0) && arefloatsApproximatelyEqual(minY, 0)) {
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
    const size = getLayoutSize(this._element);
    return !!size.width && !!size.height;
  }

  private _isUnzoomed(scale?: number): boolean {
    return scale !== undefined && round(scale, ZOOM_PRECISION) <= 1;
  }

  private _isAtDefaultZoomAndPan(x: number, y: number, scale: number): boolean {
    const defaultScale = this._defaultSettings?.zoom ?? ZOOM_DEFAULT_SCALE;

    // An unzoomed default has nothing to pan, so only the scale matters.
    if (this._isUnzoomed(defaultScale)) {
      return this._isUnzoomed(scale);
    }

    const convertedDefault = this._convertPercentToXYPan(
      this._defaultSettings?.pan?.x ?? ZOOM_DEFAULT_PAN_X,
      this._defaultSettings?.pan?.y ?? ZOOM_DEFAULT_PAN_Y,
      defaultScale,
    );

    // Without a size the pan cannot be compared, only the scale.
    if (!convertedDefault) {
      return arefloatsApproximatelyEqual(scale, defaultScale);
    }

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
    let point: { clientX: number; clientY: number } | null = null;
    if (window.TouchEvent && ev instanceof TouchEvent) {
      const touches = ev.type === 'touchstart' ? ev.touches : ev.changedTouches;
      point = touches.length === 1 ? touches[0] : null;
    } else if (ev instanceof PointerEvent) {
      // A non-primary pointer is a second finger, which makes the gesture a
      // pinch (which does not count as a tap).
      point = ev.isPrimary ? ev : null;
    }
    return point ? { x: point.clientX, y: point.clientY, time: ev.timeStamp } : null;
  }

  // While zoomed, the controller consumes every gesture to pan, so the card's
  // `double_tap_action` never sees a double tap. The controller reports one as
  // `zoom:home` instead.
  private _handleTap(ev: Event): void {
    const start = this._tapStart;
    this._tapStart = null;

    if (!['pointerup', 'touchend'].includes(ev.type)) {
      // A leave or cancel while a pointer is down ends the tap in progress, and
      // any double tap with it. A touch on a hoverable device also fires
      // pointerleave right after its pointerup, when no pointer is down, and
      // that must not break a double tap.
      if (start) {
        this._lastTap = null;
      }
      return;
    }

    const end = this._getTapPoint(ev);
    if (!start || !end || !isTap(start, end)) {
      this._lastTap = null;
      return;
    }

    if (this._lastTap && isDoubleTap(this._lastTap, end)) {
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
    this._element.style.touchAction = touchEnabled ? UNZOOMED_TOUCH_ACTION : 'none';
  }
}
