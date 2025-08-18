import { ReactiveController, ReactiveControllerHost } from 'lit';
import { debounce } from 'lodash-es';
import { CameraDimensionsConfig } from '../config/schema/cameras';
import { MediaLoadedInfo } from '../types';
import {
  aspectRatioToString,
  setOrRemoveAttribute,
  setOrRemoveStyleProperty,
} from '../utils/basic';
import { AdvancedCameraCardMediaLoadedEventTarget } from '../utils/media-info';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout';

const ROTATED_ATTRIBUTE = 'rotated';

interface MediaDimensions {
  width: number;
  height: number;
}

/**
 * Controller for managing media dimensions in a container. This accepts two
 * containers (inner and outer). The inner container is expected to contain the
 * media itself, the outer container is used to change the height that the inner
 * container is allowed to be. This is necessary since when the inner container
 * is rotated, the outer container will already have been sized by browser
 * ignoring the rotation -- so the outer container has its height manually set
 * based on the expected rotation height. The host itself (this element) needs
 * to not have a fixed height, in order for the ResizeObserver to work
 * correctly, necessitating the use of a special outer container.
 */
export class MediaDimensionsContainerController implements ReactiveController {
  private _host: HTMLElement & ReactiveControllerHost;

  private _dimensionsConfig: CameraDimensionsConfig | null = null;

  private _innerContainer:
    | (HTMLElement & AdvancedCameraCardMediaLoadedEventTarget)
    | null = null;
  private _outerContainer: HTMLElement | null = null;

  public resize = debounce(this._resize.bind(this), 100, { trailing: true });
  private _resizeObserver = new ResizeObserver(this.resize);

  private _mediaDimensions: MediaDimensions | null = null;

  constructor(host: HTMLElement & ReactiveControllerHost) {
    this._host = host;
    this._host.addController(this);
  }

  public hostConnected(): void {
    this._resizeObserver.observe(this._host);
    this._addInnerContainerListeners();
  }

  public hostDisconnected(): void {
    this._resizeObserver.disconnect();
    this._removeInnerContainerListeners();
  }

  private _removeInnerContainerListeners(): void {
    if (!this._innerContainer) {
      return;
    }
    this._innerContainer.removeEventListener('slotchange', this.resize);
    this._innerContainer.removeEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadedHandler,
    );
  }

  private _addInnerContainerListeners(): void {
    if (!this._host.isConnected || !this._innerContainer) {
      return;
    }

    this._innerContainer.addEventListener('slotchange', this.resize);
    this._innerContainer.addEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadedHandler,
    );
  }

  private _mediaLoadedHandler = (ev: CustomEvent<MediaLoadedInfo>): void => {
    // Only resize if the media dimensions have changed (otherwise the loading
    // image whilst waiting for the stream, will trigger aresize every second).
    if (
      this._mediaDimensions?.width === ev.detail.width &&
      this._mediaDimensions.height === ev.detail.height
    ) {
      return;
    }

    this._mediaDimensions = {
      width: ev.detail.width,
      height: ev.detail.height,
    };
    this.resize();
  };

  public setConfig(dimensionsConfig?: CameraDimensionsConfig): void {
    if (dimensionsConfig === this._dimensionsConfig) {
      return;
    }

    this._dimensionsConfig = dimensionsConfig ?? null;
    this._setInnerContainerProperties();
  }

  public setContainers(
    innerContainer?: HTMLElement,
    outerContainer?: HTMLElement,
  ): void {
    if (
      (innerContainer ?? null) === this._innerContainer &&
      (outerContainer ?? null) === this._outerContainer
    ) {
      return;
    }

    this._removeInnerContainerListeners();

    this._innerContainer = innerContainer ?? null;
    this._outerContainer = outerContainer ?? null;

    this._addInnerContainerListeners();
    this._setInnerContainerProperties();
    this._resize();
  }

  private _hasFixedAspectRatio(): boolean {
    return this._dimensionsConfig?.aspect_ratio?.length === 2;
  }

  private _requiresRotation(): boolean {
    return !!this._dimensionsConfig?.rotation;
  }

  private _requiresContainerRotation(): boolean {
    // The actual container only needs to rotate if the rotation parameter is 90
    // or 270.
    return (
      this._dimensionsConfig?.rotation === 90 || this._dimensionsConfig?.rotation === 270
    );
  }

  private _setInnerContainerProperties(): void {
    if (!this._innerContainer) {
      return;
    }

    setOrRemoveStyleProperty(
      this._innerContainer,
      this._requiresRotation(),
      '--advanced-camera-card-media-rotation',
      `${this._dimensionsConfig?.rotation}deg`,
    );

    this._innerContainer.style.aspectRatio = aspectRatioToString({
      ratio: this._dimensionsConfig?.aspect_ratio,
    });

    updateElementStyleFromMediaLayoutConfig(
      this._innerContainer,
      this._dimensionsConfig?.layout,
    );
  }

  // ==============
  // Resize helpers
  // ==============

  private _setMaxSize = (element: HTMLElement): void =>
    this._setSize(element, {
      width: '100%',
      height: '100%',
    });

  private _setIntrinsicSize = (element: HTMLElement): void =>
    this._setSize(element, {
      width: 'max-content',
      height: 'max-content',
    });

  private _setWidthBoundIntrinsicSize = (element: HTMLElement): void =>
    this._setSize(element, {
      width: '100%',
      height: 'auto',
    });

  private _setHeightBoundIntrinsicSize = (element: HTMLElement): void =>
    this._setSize(element, {
      width: 'auto',
      height: '100%',
    });

  private _setInvisible = (element: HTMLElement): void => {
    element.style.visibility = 'hidden';
  };

  private _setVisible = (element: HTMLElement): void => {
    element.style.visibility = '';
  };

  private _setSize(
    element: HTMLElement,
    options: { width?: number | string; height: number | string },
  ): void {
    const toCSS = (value: number | string): string =>
      typeof value === 'number' ? `${value}px` : value;

    if (options.width !== undefined) {
      element.style.width = toCSS(options.width);
    }

    element.style.height = toCSS(options.height);
  }

  private _setRotation(element: HTMLElement, rotate: boolean): void {
    setOrRemoveAttribute(element, rotate, ROTATED_ATTRIBUTE);
  }

  private _resize(): void {
    if (this._requiresRotation()) {
      this._resizeAndRotate();
    } else if (this._hasFixedAspectRatio()) {
      this._resizeWithFixedAspectRatio();
    } else {
      this._resizeDefault();
    }
  }

  private _resizeDefault(): void {
    if (!this._innerContainer || !this._outerContainer) {
      return;
    }
    this._setMaxSize(this._innerContainer);
    this._setMaxSize(this._outerContainer);
    this._setRotation(this._host, false);
    this._setVisible(this._innerContainer);
  }

  private _resizeWithFixedAspectRatio(): void {
    if (!this._innerContainer || !this._outerContainer) {
      return;
    }

    this._setInvisible(this._innerContainer);

    this._setWidthBoundIntrinsicSize(this._innerContainer);
    this._setMaxSize(this._outerContainer);
    this._setRotation(this._host, false);

    const hostSize = this._host.getBoundingClientRect();
    const innerContainerSize = this._innerContainer.getBoundingClientRect();

    if (this._resizeDefaultIfInvalidSizes([hostSize, innerContainerSize])) {
      return;
    }

    // If the container is larger than the host, the host was not able to expand
    // enough to cover the size (e.g. fullscreen, panel or height constrained in
    // configuration). In this case, just limit the container to the host height
    // at the same aspect ratio.
    if (innerContainerSize.height > hostSize.height) {
      this._setHeightBoundIntrinsicSize(this._innerContainer);
    }

    this._setVisible(this._innerContainer);
  }

  private _hasValidSize(size: DOMRect): boolean {
    return size.width > 0 && size.height > 0;
  }

  private _resizeDefaultIfInvalidSizes(sizes: DOMRect[]): boolean {
    if (sizes.some((size) => !this._hasValidSize(size))) {
      this._resizeDefault();
      return true;
    }
    return false;
  }

  private _resizeAndRotate(): void {
    if (!this._innerContainer || !this._outerContainer) {
      return;
    }

    if (!this._requiresContainerRotation()) {
      this._resizeDefault();
      this._setRotation(this._host, true);
      return;
    }

    this._setInvisible(this._innerContainer);

    // Render the media entirely unhindered to get the native aspect ratio.
    this._setIntrinsicSize(this._innerContainer);
    this._setMaxSize(this._outerContainer);
    this._setRotation(this._host, false);

    let hostSize = this._host.getBoundingClientRect();
    let innerContainerSize = this._innerContainer.getBoundingClientRect();

    if (this._resizeDefaultIfInvalidSizes([hostSize, innerContainerSize])) {
      return;
    }

    const aspectRatio = innerContainerSize.width / innerContainerSize.height;

    this._setRotation(this._host, true);

    // Set the inner container to the correct rotated sizes (ignoring any
    // constraint of host size).
    this._setSize(this._innerContainer, {
      width: hostSize.width * aspectRatio,
      height: hostSize.width,
    });

    this._setSize(this._outerContainer, {
      height: hostSize.width * aspectRatio,
    });

    // Refresh the sizes post rotation & initial sizing.
    innerContainerSize = this._innerContainer.getBoundingClientRect();
    hostSize = this._host.getBoundingClientRect();

    if (this._resizeDefaultIfInvalidSizes([hostSize, innerContainerSize])) {
      return;
    }

    // As in `_resizeWithFixedAspectRatio` resize the media if the host was not
    // able to expand to cover the size.
    if (innerContainerSize.height > hostSize.height) {
      this._setSize(this._innerContainer, {
        width: hostSize.height,
        height: hostSize.height / aspectRatio,
      });
      this._setSize(this._outerContainer, {
        height: hostSize.height,
      });
    }

    this._setVisible(this._innerContainer);
  }
}
