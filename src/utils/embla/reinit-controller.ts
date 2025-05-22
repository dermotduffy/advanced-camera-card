import { EmblaCarouselType } from 'embla-carousel';
import { debounce } from 'lodash-es';

/**
 * This class takes care of "safe re-initializing": Only re-initializing the
 * carousel when it is not scrolling (unlike the builtin Embla reinitializations,
 * e.g. slide additions or resizes). Without this class the carousel is visually
 * jarring as in-progress transitions are skipped (vs completing prior to
 * reinit).
 */

export class EmblaReInitController {
  protected _emblaApi: EmblaCarouselType;
  protected _scrolling = false;
  protected _shouldReInitOnScrollStop = false;

  constructor(emblaApi: EmblaCarouselType) {
    this._emblaApi = emblaApi;
    this._emblaApi.on('scroll', this._scrollingStart);
    this._emblaApi.on('settle', this._scrollingStop);
    this._emblaApi.on('destroy', this.destroy);
  }

  public destroy(): void {
    this._emblaApi.off('scroll', this._scrollingStart);
    this._emblaApi.off('settle', this._scrollingStop);
    this._emblaApi.off('destroy', this.destroy);
  }

  public reinit(): void {
    if (this._scrolling) {
      this._shouldReInitOnScrollStop = true;
    } else {
      this._debouncedReInit();
    }
  }

  protected _scrollingStart = (): void => {
    this._scrolling = true;
  };

  protected _scrollingStop = (): void => {
    this._scrolling = false;

    if (this._shouldReInitOnScrollStop) {
      this._shouldReInitOnScrollStop = false;
      this._debouncedReInit();
    }
  };

  protected _debouncedReInit = debounce(
    () => {
      this._scrolling = false;
      this._shouldReInitOnScrollStop = false;
      this._emblaApi?.reInit();
    },
    500,
    { trailing: true },
  );
}
