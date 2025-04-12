import { ReactiveController, ReactiveControllerHost } from 'lit';
import { LazyUnloadCondition } from '../config/schema/common/media-actions';

type LazyLoadListener = (loaded: boolean) => void;

export class LazyLoadController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _documentVisible = true;
  private _intersects = false;
  private _loaded: boolean;
  private _unloadConditions: LazyUnloadCondition[] | null = null;
  private _intersectionObserver = new IntersectionObserver(
    this._intersectionHandler.bind(this),
  );
  private _listeners: LazyLoadListener[] = [];

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    lazyLoad?: boolean,
    lazyUnloadConditions?: LazyUnloadCondition[],
  ) {
    this._host = host;
    this._host.addController(this);

    this._loaded = !lazyLoad;
    this._unloadConditions = lazyUnloadConditions ?? null;
  }

  public destroy(): void {
    this._removeEventHandlers();
    this._listeners = [];
  }

  public isLoaded(): boolean {
    return this._loaded;
  }

  public addListener(listener: LazyLoadListener): void {
    this._listeners.push(listener);
  }

  public removeListener(listener: LazyLoadListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  public removeController(): void {
    this._host.removeController(this);
  }

  public hostConnected(): void {
    this._addEventHandlers();
  }

  public hostDisconnected(): void {
    this._removeEventHandlers();
    this._setLoaded(false);
  }

  private _addEventHandlers(): void {
    document.addEventListener('visibilitychange', this._visibilityHandler);
    this._intersectionObserver.observe(this._host);
  }

  private _removeEventHandlers(): void {
    document.removeEventListener('visibilitychange', this._visibilityHandler);
    this._intersectionObserver.disconnect();
  }

  private _lazyLoadOrUnloadIfNecessary(): void {
    const shouldBeLoaded = !this._loaded && this._documentVisible && this._intersects;
    const shouldBeUnloaded =
      this._loaded &&
      ((this._unloadConditions?.includes('hidden') && !this._documentVisible) ||
        (this._unloadConditions?.includes('unselected') && !this._intersects));

    if (shouldBeLoaded) {
      this._setLoaded(true);
    } else if (shouldBeUnloaded) {
      this._setLoaded(false);
    }
  }

  private _setLoaded(loaded: boolean): void {
    this._loaded = loaded;
    this._notifyListeners();
    this._host.requestUpdate();
  }

  private _notifyListeners(): void {
    this._listeners.forEach((listener) => listener(this._loaded));
  }

  private _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    this._intersects = entries.some((entry) => entry.isIntersecting);
    this._lazyLoadOrUnloadIfNecessary();
  }

  private _visibilityHandler = (): void => {
    this._documentVisible = document.visibilityState === 'visible';
    this._lazyLoadOrUnloadIfNecessary();
  };
}
