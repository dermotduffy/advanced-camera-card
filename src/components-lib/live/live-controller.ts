import { LitElement, ReactiveController } from 'lit';
import { MediaLoadedInfo } from '../../types.js';
import {
  AdvancedCameraCardMediaLoadedEventTarget,
  dispatchExistingMediaLoadedInfoAsEvent,
} from '../../utils/media-info.js';

interface LiveViewContext {
  // A cameraID override (used for dependencies/substreams to force a different
  // camera to be live rather than the camera selected in the view).
  overrides?: Map<string, string>;
}

declare module 'view' {
  interface ViewContext {
    live?: LiveViewContext;
  }
}

interface LastMediaLoadedInfo {
  mediaLoadedInfo: MediaLoadedInfo;
  source: EventTarget;
}

type LiveControllerHost = LitElement & AdvancedCameraCardMediaLoadedEventTarget;

export class LiveController implements ReactiveController {
  private _host: LiveControllerHost;

  // Whether or not the live view is currently in the background (i.e. preloaded
  // but not visible).
  private _inBackground = false;

  // Intersection handler is used to detect when the live view flips between
  // foreground and background (in preload mode).
  private _intersectionObserver: IntersectionObserver;

  // MediaLoadedInfo object and target from the underlying live media. In the
  // case of pre-loading these may be propagated later (from the original
  // source).
  private _lastMediaLoadedInfo: LastMediaLoadedInfo | null = null;

  constructor(host: LiveControllerHost) {
    this._host = host;

    host.addController(this);

    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  public hostConnected(): void {
    this._intersectionObserver.observe(this._host);

    this._host.addEventListener(
      'advanced-camera-card:media:loaded',
      this._handleMediaLoaded,
    );
  }

  public hostDisconnected(): void {
    this._intersectionObserver.disconnect();

    this._host.removeEventListener(
      'advanced-camera-card:media:loaded',
      this._handleMediaLoaded,
    );
  }

  public isInBackground(): boolean {
    return this._inBackground;
  }

  private _handleMediaLoaded = (ev: CustomEvent<MediaLoadedInfo>): void => {
    this._lastMediaLoadedInfo = {
      source: ev.composedPath()[0],
      mediaLoadedInfo: ev.detail,
    };

    if (this._inBackground) {
      ev.stopPropagation();
    }
  };

  private _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    const wasInBackground = this._inBackground;
    this._inBackground = !entries.some((entry) => entry.isIntersecting);

    if (!this._inBackground && this._lastMediaLoadedInfo) {
      // If this isn't being rendered in the background, the last render did not
      // generate a message and there's a saved MediaInfo, dispatch it upwards.
      dispatchExistingMediaLoadedInfoAsEvent(
        // Specifically dispatch the event "where it came from", as otherwise
        // the intermediate layers (e.g. media-carousel which controls the title
        // popups) will not re-receive the events.
        this._lastMediaLoadedInfo.source,
        this._lastMediaLoadedInfo.mediaLoadedInfo,
      );
    }

    if (wasInBackground !== this._inBackground) {
      this._host.requestUpdate();
    }
  }
}
