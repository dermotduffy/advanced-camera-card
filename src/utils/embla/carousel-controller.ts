import EmblaCarousel, { EmblaCarouselType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins';
import { isEqual } from 'lodash-es';
import { TransitionEffect } from '../../config/schema/common/transition-effect.js';
import { getChildrenFromElement } from '../basic.js';
import { fireAdvancedCameraCardEvent } from '../fire-advanced-camera-card-event';
import { TextDirection } from '../text-direction';

export interface CarouselSelected {
  index: number;
  element: HTMLElement;
}

type EmblaCarouselPlugins = CreatePluginType<LoosePluginType, Record<string, unknown>>[];

export type CarouselDirection = 'vertical' | 'horizontal';

export class CarouselController {
  protected _parent: HTMLElement;
  protected _root: HTMLElement;
  protected _direction: CarouselDirection;
  protected _startIndex: number;
  protected _transitionEffect: TransitionEffect;
  protected _loop: boolean;
  protected _dragFree: boolean;
  protected _draggable: boolean;
  protected _textDirection: TextDirection;
  protected _wheelScrolling: boolean;

  protected _plugins: EmblaCarouselPlugins;
  protected _carousel: EmblaCarouselType;

  protected _mutationObserver = new MutationObserver(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_mutations: MutationRecord[], _observer: MutationObserver) =>
      this._refreshCarouselContents(),
  );

  constructor(
    root: HTMLElement,
    parent: HTMLElement,
    options?: {
      direction?: CarouselDirection;
      transitionEffect?: TransitionEffect;
      startIndex?: number;
      loop?: boolean;
      dragEnabled?: boolean;
      dragFree?: boolean;
      plugins?: EmblaCarouselPlugins;
      textDirection?: TextDirection;
      wheelScrolling?: boolean;
    },
  ) {
    this._root = root;
    this._parent = parent;
    this._direction = options?.direction ?? 'horizontal';
    this._transitionEffect = options?.transitionEffect ?? 'slide';
    this._startIndex = options?.startIndex ?? 0;
    this._dragFree = options?.dragFree ?? false;
    this._loop = options?.loop ?? false;
    this._draggable = options?.dragEnabled ?? true;
    this._plugins = options?.plugins ?? [];
    this._textDirection = options?.textDirection ?? 'ltr';
    this._wheelScrolling = options?.wheelScrolling ?? true;

    this._carousel = this._createCarousel(getChildrenFromElement(this._parent));

    // Need to separately listen for slotchanges since mutation observer will
    // not be called for shadom DOM slotted changes.
    if (parent instanceof HTMLSlotElement) {
      parent.addEventListener('slotchange', this._refreshCarouselContents);
    }
    this._mutationObserver.observe(this._parent, { childList: true });
  }

  public destroy() {
    if (this._parent instanceof HTMLSlotElement) {
      this._parent.removeEventListener('slotchange', this._refreshCarouselContents);
    }
    this._mutationObserver.disconnect();
    this._carousel.destroy();
  }

  public getSlide(index: number): HTMLElement | null {
    return this._carousel.slideNodes()[index] ?? null;
  }

  public getSelectedSlide(): HTMLElement | null {
    return this.getSlide(this.getSelectedIndex());
  }

  public getSelectedIndex(): number {
    return this._carousel.selectedScrollSnap();
  }

  public selectSlide(index: number): void {
    if (index < 0 || index >= this._carousel.slideNodes().length) {
      return;
    }
    this._carousel.scrollTo(index, this._transitionEffect === 'none');

    // This event exists to allow the caller to know the difference between
    // programatically force slide selections and user-driven slide selections
    // (e.g. carousel drags). See the note in auto-media-loaded-info.ts on how
    // this is used.
    const newSlide = this.getSlide(index);

    /* istanbul ignore if: defensive guard for getSlide returning null which can
    only happen with an index out of bounds, which is guarded against above --
    @preserve */
    if (newSlide) {
      fireAdvancedCameraCardEvent<CarouselSelected>(
        this._parent,
        'carousel:force-select',
        {
          index: index,
          element: newSlide,
        },
      );
    }
  }

  protected _refreshCarouselContents = (): void => {
    const slides = getChildrenFromElement(this._parent);
    const slidesChanged = !isEqual(this._carousel.slideNodes(), slides);
    if (slidesChanged) {
      this._carousel.reInit({ slides });
    }
  };

  protected _createCarousel(slides: HTMLElement[]): EmblaCarouselType {
    const carousel = EmblaCarousel(
      this._root,
      {
        slides: slides,

        axis: this._direction === 'horizontal' ? 'x' : 'y',
        duration: 20,
        startIndex: this._startIndex,
        dragFree: this._dragFree,
        loop: this._loop,

        containScroll: 'trimSnaps',

        // This controller manages slide changes (including shadow DOM
        // assignments, which the stock watcher does not handle).
        watchSlides: false,
        watchResize: true,
        watchDrag: this._draggable,

        direction: this._textDirection,
      },
      [
        ...this._plugins,
        ...(slides.length > 1 && this._wheelScrolling
          ? [
              WheelGesturesPlugin({
                // Whether the carousel is vertical or horizontal, interpret y-axis wheel
                // gestures as scrolling for the carousel.
                forceWheelAxis: 'y',
              }),
            ]
          : []),
      ],
    );

    const getCarouselSelectedObject = (): CarouselSelected | null => {
      // Caution: Must use methods/accessors of the new carousel, not the public
      // API of this controller which may use a different carousel.
      const selectedIndex = carousel.selectedScrollSnap();
      const slide = carousel.slideNodes()[selectedIndex] ?? null;
      if (slide) {
        return {
          index: selectedIndex,
          element: slide,
        };
      }
      return null;
    };

    const selectSlide = (): void => {
      const carouselSelected = getCarouselSelectedObject();
      if (carouselSelected) {
        fireAdvancedCameraCardEvent<CarouselSelected>(
          this._parent,
          'carousel:select',
          carouselSelected,
        );
      }
    };

    carousel.on('select', () => selectSlide());
    return carousel;
  }
}
