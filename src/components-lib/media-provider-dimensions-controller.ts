import { ReactiveController, ReactiveControllerHost } from 'lit';
import { throttle } from 'lodash-es';
import { CameraDimensionsConfig } from '../config/schema/cameras';
import { MediaLoadedInfo } from '../types';
import { aspectRatioToString, setOrRemoveAttribute } from '../utils/basic';
import { AdvancedCameraCardMediaLoadedEventTarget } from '../utils/media-info';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout';

const SIZE_ATTRIBUTE = 'size';
type SizeMode = 'sized' | 'unsized' | 'unsized-portrait' | 'unsized-landscape';

export class MediaProviderDimensionsController implements ReactiveController {
  private _host: HTMLElement &
    ReactiveControllerHost &
    AdvancedCameraCardMediaLoadedEventTarget;
  private _container: HTMLElement | null = null;
  private _cameraConfig: CameraDimensionsConfig | null = null;
  private _throttledResizeHandler = throttle(this._resizeHandler.bind(this), 100, {
    trailing: true,
  });
  private _resizeObserver = new ResizeObserver(this._throttledResizeHandler);
  private _intendedHostSize: DOMRect | null = null;

  constructor(host: HTMLElement & ReactiveControllerHost) {
    this._host = host;
    this._host.addController(this);
  }

  public hostConnected(): void {
    this._host.addEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadHandler,
    );

    this._resizeObserver.observe(this._host);
  }

  public hostDisconnected(): void {
    this._host.removeEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadHandler,
    );
    this._resizeObserver.disconnect();
  }

  public setContainer(container?: HTMLElement): void {
    if (container === this._container) {
      return;
    }
    this._container = container ?? null;
    this._setAttributesFromConfig();
  }

  private _setAttributesFromConfig(): void {
    if (this._container) {
      this._container.style.aspectRatio = aspectRatioToString({
        ratio: this._cameraConfig?.aspect_ratio,
      });
    }

    updateElementStyleFromMediaLayoutConfig(this._host, this._cameraConfig?.layout);

    // When the provider is not precisely sized, we guess the best aspect
    // ratio to "maximize" if known. This prevents media "hopping" from no
    // forced aspect ratio to a forced one, once its true size is known.
    setOrRemoveAttribute<SizeMode>(
      this._host,
      true,
      SIZE_ATTRIBUTE,
      this._cameraConfig?.aspect_ratio
        ? this._cameraConfig?.aspect_ratio[0] >= this._cameraConfig?.aspect_ratio[1]
          ? 'unsized-landscape'
          : 'unsized-portrait'
        : 'unsized',
    );
  }

  public setCameraConfig(config?: CameraDimensionsConfig): void {
    this._cameraConfig = config ?? null;
    this._setAttributesFromConfig();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _mediaLoadHandler = (_ev: CustomEvent<MediaLoadedInfo>): void => {
    // Allow the browser to render the media fully before attempting to resize.
    // Without this, viewer provider will not be sized correctly.
    window.requestAnimationFrame(() => this._throttledResizeHandler());
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _resizeHandler(_entries?: ResizeObserverEntry[]): void {
    const rememberHostSize = (): void => {
      this._intendedHostSize = this._host.getBoundingClientRect();
    };

    const setUnsizedAttribute = (): void => {
      setOrRemoveAttribute<SizeMode>(this._host, true, SIZE_ATTRIBUTE, 'unsized');
    };

    const setContainerIntrinsicSize = (container: HTMLElement): void => {
      container.style.width = '100%';
      container.style.height = 'auto';
      rememberHostSize();
    };

    const setContainerSize = (
      container: HTMLElement,
      width: number,
      height: number,
    ): void => {
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      rememberHostSize();
    };

    const hostSize = this._host.getBoundingClientRect();
    if (
      hostSize.width === this._intendedHostSize?.width &&
      hostSize.height === this._intendedHostSize?.height
    ) {
      return;
    }

    if (!this._container) {
      setUnsizedAttribute();
      return;
    }

    // In the ideal case, the width can be maximum and the height can be
    // whatever is necessary to support the aspect ratio.
    setContainerIntrinsicSize(this._container);

    const containerSize = this._container.getBoundingClientRect();

    if (!containerSize.width || !containerSize.height) {
      setUnsizedAttribute();
      return;
    }

    const mediaAspectRatio = containerSize.width / containerSize.height;
    const newHostSize = this._host.getBoundingClientRect();

    // If the container is larger than the host, the host was not able to expand
    // enough to cover the size (e.g. fullscreen, panel or height constrained in
    // configuration). In this case, just limit the container to the host height
    // at the same aspect ratio.
    if (containerSize.height > newHostSize.height) {
      setContainerSize(
        this._container,
        newHostSize.height * mediaAspectRatio,
        newHostSize.height,
      );
    }

    setOrRemoveAttribute<SizeMode>(this._host, true, SIZE_ATTRIBUTE, 'sized');
  }
}
