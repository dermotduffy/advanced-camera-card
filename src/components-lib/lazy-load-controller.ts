import { ReactiveController, ReactiveControllerHost } from 'lit';
import { LazyUnloadCondition } from '../config/schema/common/media-actions';

type LazyLoadListener = (loaded: boolean) => void;

interface LazyLoadConfiguration {
  // Whether to wait for the host to intersect (and the document to be visible)
  // before loading. `false` loads eagerly on first call.
  lazyLoad?: boolean;

  // Conditions under which an already-loaded host should unload.
  lazyUnloadConditions?: LazyUnloadCondition[];

  // Treat the host as the selected/visible item, regardless of what
  // IntersectionObserver reports.
  forceSelected?: boolean;
}

export class LazyLoadController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _documentVisible = true;
  private _intersects = false;
  private _forceSelected = false;
  private _loaded = false;
  private _unloadConditions: LazyUnloadCondition[] = [];
  private _intersectionObserver = new IntersectionObserver(
    this._intersectionHandler.bind(this),
  );
  private _listeners: LazyLoadListener[] = [];

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    this._host.addController(this);
  }

  public setConfiguration(configuration: LazyLoadConfiguration): void {
    this._unloadConditions = configuration.lazyUnloadConditions ?? [];
    this._forceSelected = configuration.forceSelected ?? false;

    // Eager-load fast path: skip re-evaluation so an immediately-applied
    // `unselected` unload condition can't undo the eager load before the
    // intersection observer has had a chance to fire.
    if (configuration.lazyLoad === false && !this._loaded) {
      this._setLoaded(true);
      return;
    }
    this._lazyLoadOrUnloadIfNecessary();
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
    // Capture the document's actual visibility state on connection. The
    // `visibilitychange` listener only fires on transitions, so without this
    // sync read a host that connects while the tab is already hidden would
    // incorrectly believe the document is visible until the next transition.
    this._documentVisible = document.visibilityState === 'visible';
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
    const effectivelyIntersects = this._intersects || this._forceSelected;
    const shouldBeLoaded =
      !this._loaded && this._documentVisible && effectivelyIntersects;
    const shouldBeUnloaded =
      this._loaded &&
      ((this._unloadConditions.includes('hidden') && !this._documentVisible) ||
        (this._unloadConditions.includes('unselected') && !effectivelyIntersects));

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
