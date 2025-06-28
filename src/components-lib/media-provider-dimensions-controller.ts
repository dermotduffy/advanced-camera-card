import { ReactiveController, ReactiveControllerHost } from 'lit';
import { CameraDimensionsConfig } from '../config/schema/cameras';
import { aspectRatioToString, setOrRemoveAttribute } from '../utils/basic';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout';

const SIZE_ATTRIBUTE = 'size';
type SizeMode = 'sized' | 'unsized' | 'unsized-portrait' | 'unsized-landscape';

const SIZE_TOLERANCE_PIXELS = 3;
export class MediaProviderDimensionsController implements ReactiveController {
  private _resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
  private _host: HTMLElement & ReactiveControllerHost;
  private _container: HTMLElement | null = null;
  private _cameraConfig: CameraDimensionsConfig | null = null;

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
    if (this._container) {
      this._resizeObserver.observe(this._container);
    }
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
    if (this._container) {
      this._resizeObserver.unobserve(this._container);
    }
    this._container = container ?? null;
    if (container) {
      if (this._host.isConnected) {
        this._resizeObserver.observe(container);
      }
      this._setAttributesFromConfig();
    }
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

  private _mediaLoadHandler = (): void => {
    // Allow the browser to render the media fully before attempting to resize.
    // Without this, viewer provider will not be sized correctly.
    window.requestAnimationFrame((): void => {
      this._resizeHandler();
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _resizeHandler(_entries?: ResizeObserverEntry[]): void {
    const setUnsized = (): void => {
      setOrRemoveAttribute<SizeMode>(this._host, true, SIZE_ATTRIBUTE, 'unsized');
    };

    if (!this._container) {
      setUnsized();
      return;
    }

    const hostSize = this._host.getBoundingClientRect();

    const priorContainerSize = this._container.getBoundingClientRect();

    // Remove prior forced width/height to get the intrinsic size.
    this._container.style.width = 'auto';
    this._container.style.height = 'auto';
    const containerSize = this._container.getBoundingClientRect();

    if (
      !hostSize.width ||
      !hostSize.height ||
      !containerSize.width ||
      !containerSize.height
    ) {
      setUnsized();
      return;
    }

    const mediaAspectRatio = containerSize.width / containerSize.height;

    let width: number;
    let height: number;
    if (hostSize.width / hostSize.height > mediaAspectRatio) {
      // Container is wider than media aspect ratio: limit by height
      height = hostSize.height;
      width = height * mediaAspectRatio;
    } else {
      // Container is narrower or equal: limit by width
      width = hostSize.width;
      height = width / mediaAspectRatio;
    }

    // This is paranoia and has not yet been proven to be necessary, however if
    // the difference is less than a tolerance stick with the original size to
    // avoid infinite loops.
    if (Math.abs(priorContainerSize.width - width) < SIZE_TOLERANCE_PIXELS) {
      width = priorContainerSize.width;
    }
    if (Math.abs(priorContainerSize.height - height) < SIZE_TOLERANCE_PIXELS) {
      height = priorContainerSize.height;
    }

    this._container.style.width = `${width}px`;
    this._container.style.height = `${height}px`;

    setOrRemoveAttribute<SizeMode>(this._host, true, SIZE_ATTRIBUTE, 'sized');
  }
}
