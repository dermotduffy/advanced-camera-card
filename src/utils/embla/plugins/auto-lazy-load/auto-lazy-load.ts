import { EmblaCarouselType, EmblaEventType } from 'embla-carousel';
import { CreateOptionsType } from 'embla-carousel/components/Options';
import { OptionsHandlerType } from 'embla-carousel/components/OptionsHandler';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins';
import { LazyUnloadCondition } from '../../../../config/schema/common/media-actions';

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    lazyload?: AutoLazyLoadType;
  }
}

type OptionsType = CreateOptionsType<{
  // Number of slides to lazyload left/right of selected (0 == only selected
  // slide).
  lazyLoadCount: number;
  lazyUnloadConditions?: readonly LazyUnloadCondition[];

  lazyLoadCallback?: (index: number, slide: HTMLElement) => void;
  lazyUnloadCallback?: (index: number, slide: HTMLElement) => void;
}>;
type AutoLazyLoadOptionsType = Partial<OptionsType>;
type AutoLazyLoadType = CreatePluginType<LoosePluginType, AutoLazyLoadOptionsType>;

const defaultOptions: OptionsType = {
  active: true,
  breakpoints: {},
  lazyLoadCount: 0,
};

export function AutoLazyLoad(
  userOptions: AutoLazyLoadOptionsType = {},
): AutoLazyLoadType {
  let options: OptionsType;
  let emblaApi: EmblaCarouselType;
  let slides: HTMLElement[];
  const lazyLoadedSlides: Set<number> = new Set();

  const loadEvents: EmblaEventType[] = ['init', 'select'];
  const unloadEvents: EmblaEventType[] = ['select'];

  function init(
    emblaApiInstance: EmblaCarouselType,
    optionsHandler: OptionsHandlerType,
  ): void {
    const { mergeOptions, optionsAtMedia } = optionsHandler;
    const allOptions = mergeOptions(defaultOptions, userOptions);
    options = optionsAtMedia(allOptions);

    emblaApi = emblaApiInstance;
    slides = emblaApi.slideNodes();

    if (options.lazyLoadCallback) {
      loadEvents.forEach((evt) => emblaApi.on(evt, lazyLoadHandler));
    }
    if (
      options.lazyUnloadCallback &&
      options.lazyUnloadConditions?.includes('unselected')
    ) {
      unloadEvents.forEach((evt) => emblaApi.on(evt, lazyUnloadPreviousHandler));
    }
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function destroy(): void {
    if (options.lazyLoadCallback) {
      loadEvents.forEach((evt) => emblaApi.off(evt, lazyLoadHandler));
    }
    if (options.lazyUnloadCallback) {
      unloadEvents.forEach((evt) => emblaApi.off(evt, lazyUnloadPreviousHandler));
    }
    document.removeEventListener('visibilitychange', visibilityHandler);
  }

  function visibilityHandler(): void {
    if (
      document.visibilityState === 'hidden' &&
      options.lazyUnloadConditions?.includes('hidden')
    ) {
      lazyUnloadAllHandler();
    } else if (document.visibilityState === 'visible' && options.lazyLoadCallback) {
      lazyLoadHandler();
    }
  }

  function hasLazyloaded(index: number): boolean {
    return lazyLoadedSlides.has(index);
  }

  function lazyLoadHandler(): void {
    const lazyLoadCount = options.lazyLoadCount;
    const currentIndex = emblaApi.selectedScrollSnap();
    const slidesToLoad = new Set<number>();

    // Lazily load 'count' slides on either side of the slides in view.
    for (let i = 1; i <= lazyLoadCount && currentIndex - i >= 0; i++) {
      slidesToLoad.add(currentIndex - i);
    }
    slidesToLoad.add(currentIndex);
    for (let i = 1; i <= lazyLoadCount && currentIndex + i < slides.length; i++) {
      slidesToLoad.add(currentIndex + i);
    }

    slidesToLoad.forEach((index) => {
      if (!hasLazyloaded(index) && options.lazyLoadCallback) {
        lazyLoadedSlides.add(index);
        options.lazyLoadCallback(index, slides[index]);
      }
    });
  }

  function lazyUnloadAllHandler(): void {
    lazyLoadedSlides.forEach((index) => {
      if (options.lazyUnloadCallback) {
        options.lazyUnloadCallback(index, slides[index]);
        lazyLoadedSlides.delete(index);
      }
    });
  }

  function lazyUnloadPreviousHandler(): void {
    const index = emblaApi.previousScrollSnap();

    if (hasLazyloaded(index) && options.lazyUnloadCallback) {
      options.lazyUnloadCallback(index, slides[index]);
      lazyLoadedSlides.delete(index);
    }
  }

  const self: AutoLazyLoadType = {
    name: 'autoLazyLoad',
    options: userOptions,
    init,
    destroy,
  };
  return self;
}
