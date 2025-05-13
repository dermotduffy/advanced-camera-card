import { LitElement, ReactiveController } from 'lit';
import { throttle } from 'lodash-es';
import { GalleryExtendEvent } from '../../components/gallery/types';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';
import { scrollIntoView } from '../../utils/scroll';
import { sleep } from '../../utils/sleep';

const GALLERY_MIN_EXTENSION_SECONDS = 0.5;

export type GalleryColumnCountRoundMethod = 'ceil' | 'floor';

interface GalleryCoreOptions {
  columnWidth?: number;
  columnCountRoundMethod?: GalleryColumnCountRoundMethod;
  extendUp?: boolean;
  extendDown?: boolean;
}

export class GalleryCoreController implements ReactiveController {
  private _host: LitElement;
  private _intersectionObserver: IntersectionObserver;
  private _resizeObserver: ResizeObserver;

  private _options: GalleryCoreOptions | null = null;
  private _touchScrollYPosition: number | null = null;

  // Wheel / touch events may be voluminous, throttle extension calls.
  private _throttledExtendUp = throttle(
    this._extendUp.bind(this),
    GALLERY_MIN_EXTENSION_SECONDS * 1000,
    {
      leading: true,
      trailing: false,
    },
  );

  private _getSlot: () => HTMLSlotElement | null;
  private _getSentintelBottom: () => HTMLElement | null;
  private _showLoaderTop: (show: boolean) => void;
  private _showSentinelBottom: (show: boolean) => void;

  private _wasEverNonEmpty = false;

  constructor(
    host: LitElement,
    getSlot: () => HTMLSlotElement | null,
    getSentinelBottom: () => HTMLElement | null,
    showLoaderTopCallback: (show: boolean) => void,
    showSentinelBottomCallback: (show: boolean) => void,
  ) {
    this._host = host;
    this._host.addController(this);

    this._getSlot = getSlot;
    this._getSentintelBottom = getSentinelBottom;
    this._showLoaderTop = showLoaderTopCallback;
    this._showSentinelBottom = showSentinelBottomCallback;

    this._resizeObserver = new ResizeObserver(() => this._setColumnCount());
    this._intersectionObserver = new IntersectionObserver(
      async (entries: IntersectionObserverEntry[]): Promise<void> => {
        if (entries.some((entry) => entry.isIntersecting)) {
          await this._extendDown();
        }
      },
    );
  }

  public removeController(): void {
    this._host.removeController(this);
  }

  public setOptions(options: GalleryCoreOptions): void {
    this._options = options;
    this._setColumnCount();
  }

  public hostConnected(): void {
    this._resizeObserver.observe(this._host);

    // Since the scroll event does not fire if the user is already at the top of
    // the container, instead we manually use the wheel and touchstart/end
    // events to detect "top upwards scrolling" (to trigger an extension of the
    // gallery).
    this._host.addEventListener('wheel', this._wheelHandler, { passive: true });
    this._host.addEventListener('touchstart', this._touchStartHandler, {
      passive: true,
    });
    this._host.addEventListener('touchend', this._touchEndHandler);

    // Request update in order to ensure the intersection observer reconnects
    // with the loader sentinel.
    this._host.requestUpdate();
  }

  public hostDisconnected(): void {
    this._host.removeEventListener('wheel', this._wheelHandler);
    this._host.removeEventListener('touchstart', this._touchStartHandler);
    this._host.removeEventListener('touchend', this._touchEndHandler);
    this._resizeObserver.disconnect();
    this._intersectionObserver.disconnect();
  }

  public hostUpdated(): void {
    const sentinel = this._getSentintelBottom();
    this._intersectionObserver.disconnect();

    if (sentinel) {
      this._intersectionObserver.observe(sentinel);
    }
  }

  private _setColumnCount(): void {
    if (!this._options?.columnWidth) {
      return;
    }
    const roundFunc =
      this._options.columnCountRoundMethod === 'ceil' ? Math.ceil : Math.floor;

    const columns = Math.max(
      1,
      roundFunc(this._host.clientWidth / this._options.columnWidth),
    );
    this._host.style.setProperty(
      '--advanced-camera-card-gallery-columns',
      String(columns),
    );
  }

  private _touchStartHandler = (ev: TouchEvent): void => {
    // Remember the Y touch position on touch start, so that we can calculate if
    // the user gestured upwards or downards on touchend.
    if (ev.touches.length === 1) {
      this._touchScrollYPosition = ev.touches[0].screenY;
    } else {
      this._touchScrollYPosition = null;
    }
  };

  private _touchEndHandler = async (ev: TouchEvent): Promise<void> => {
    if (
      !this._host.scrollTop &&
      ev.changedTouches.length === 1 &&
      this._touchScrollYPosition !== null
    ) {
      if (ev.changedTouches[0].screenY > this._touchScrollYPosition) {
        await this._throttledExtendUp();
      }
    }
    this._touchScrollYPosition = null;
  };

  private _wheelHandler = async (ev: WheelEvent): Promise<void> => {
    if (!this._host.scrollTop && ev.deltaY < 0) {
      await this._throttledExtendUp();
    }
  };

  private async _extendUp(): Promise<void> {
    if (!this._options?.extendUp) {
      return;
    }

    this._showLoaderTop(true);

    const start = new Date();
    await this._waitForExtend('up');
    const delta = new Date().getTime() - start.getTime();

    if (delta < GALLERY_MIN_EXTENSION_SECONDS * 1000) {
      // Hidden gem: "legitimate" (?!) use of sleep() :-) These calls can return
      // very quickly even with caching disabled since the time window
      // constraints on the query will usually be very narrow and the backend
      // can thus very quickly reply. It's often so fast it actually looks like
      // a rendering issue where the progress indictor barely registers before
      // it's gone again. This optional pause ensures there is at least some
      // visual feedback to the user that lasts long enough they can 'feel' the
      // fetch has happened.
      //
      // This is only applied on the 'up' extend since the 'down' extend may be
      // called multiple times for large card sizes (e.g. fullscreen) where a
      // delay is not desirable.
      await sleep(GALLERY_MIN_EXTENSION_SECONDS - delta / 1000);
    }
    this._showLoaderTop(false);
  }

  private async _extendDown(): Promise<void> {
    if (!this._options?.extendDown) {
      return;
    }

    this._showSentinelBottom(false);

    await this._waitForExtend('down');

    // Sentinel will be re-shown next time the contents changes, see:
    // updateContents() .
  }

  private async _waitForExtend(direction: 'up' | 'down'): Promise<void> {
    await new Promise<void>((resolve) => {
      fireAdvancedCameraCardEvent<GalleryExtendEvent>(
        this._host,
        `gallery:extend:${direction}`,
        { resolve },
        {
          bubbles: false,
          composed: false,
        },
      );
    });
  }

  public updateContents(): void {
    const slot = this._getSlot();

    if (!slot) {
      return;
    }

    const contents = slot
      .assignedElements()
      .filter((element) => element instanceof HTMLElement);

    const firstSelected = contents.find(
      (element) => element.getAttribute('selected') !== null,
    );
    if (contents.length) {
      if (!this._wasEverNonEmpty && firstSelected) {
        // As a special case, if this is the first setting of the slot contents,
        // the gallery is scrolled to the selected element (if any). This is
        // only done on the first setting, as subsequent gallery extensions
        // should not cause the gallery to rescroll to the item that happens to
        // be selected.
        // See: https://github.com/dermotduffy/advanced-camera-card/issues/885
        scrollIntoView(firstSelected, {
          boundary: this._host,
          block: 'center',
        });
      }

      this._wasEverNonEmpty = true;
    }

    // Always render the bottom sentinel when the contents changes, in order to allow
    // the gallery to be extended downwards.
    this._showSentinelBottom(true);
  }
}
