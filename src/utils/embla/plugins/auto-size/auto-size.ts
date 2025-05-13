import { EmblaCarouselType } from 'embla-carousel';
import { LooseOptionsType } from 'embla-carousel/components/Options';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins';
import { debounce } from 'lodash-es';
import { EmblaReInitController } from '../../reinit-controller';

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    AutoSize?: AutoSizeType;
  }
}

type AutoSizeType = CreatePluginType<LoosePluginType, LooseOptionsType>;
interface SlideDimensions {
  height: number;
  width: number;
}

/**
 * This plugin offers the following functionality:
 * - Auto-height: Automatically resize the container to fit the largest slide on
 *   view. Unlike the stock `auto-height` plugin, this version will use active
 *   DOM sizing vs the internal engine sizes to account for pre-reinit resize
 *   detection.
 * - Resize and intersection re-initializing: Re-initialize the carousel on
 *   slide or container resizes, or container intersection changes.
 */

function AutoSize(): AutoSizeType {
  let emblaApi: EmblaCarouselType;
  let reInitController: EmblaReInitController | null = null;

  let previousContainerIntersecting: boolean | null = null;
  const previousDimensions: Map<Element, SlideDimensions> = new Map();

  const resizeObserver: ResizeObserver = new ResizeObserver(resizeHandler);
  const intersectionObserver: IntersectionObserver = new IntersectionObserver(
    intersectionHandler,
  );

  const debouncedSetContainerHeight = debounce(
    () => setContainerHeightAndReInit(),
    200,
    {
      trailing: true,
    },
  );

  function init(emblaApiInstance: EmblaCarouselType): void {
    emblaApi = emblaApiInstance;
    reInitController = new EmblaReInitController(emblaApi);

    intersectionObserver.observe(emblaApi.containerNode());
    resizeObserver.observe(emblaApi.containerNode());
    for (const slide of emblaApi.slideNodes()) {
      resizeObserver.observe(slide);
    }

    // Need to examine container size on both settle and media load, as settle
    // may happen before the media is loaded (which they subsequently changes
    // the size to large than the maxHeight is set).
    emblaApi
      .containerNode()
      .addEventListener(
        'advanced-camera-card:media:loaded',
        debouncedSetContainerHeight,
      );
    emblaApi.on('settle', debouncedSetContainerHeight);
  }

  function destroy(): void {
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
    reInitController?.destroy();

    emblaApi
      .containerNode()
      .removeEventListener(
        'advanced-camera-card:media:loaded',
        debouncedSetContainerHeight,
      );
    emblaApi.off('settle', debouncedSetContainerHeight);
  }

  function intersectionHandler(entries: IntersectionObserverEntry[]): void {
    /**
     * - If the DOM that contains this carousel changes such that it causes
     *   slides to entirely appear/disappear (e.g. `display: none` or hidden),
     *   then the displayed slide sizes will significantly change and the
     *   carousel will need to be reinitialized. Without this, odd bugs may
     *   occur for some users in some circumstances causing the carousel to
     *   appear 'stuck'.
     * - Example bug when this reinitialization is not performed:
     *   https://github.com/dermotduffy/advanced-camera-card/issues/651
     */
    const isContainerIntersectingNow = entries.some((entry) => entry.isIntersecting);

    if (isContainerIntersectingNow !== previousContainerIntersecting) {
      // Don't reinitialize on first call (intersectionHandler is always called
      // on initial observation), nor when the viewport is not intersecting.
      const callReInit =
        isContainerIntersectingNow && previousContainerIntersecting !== null;
      previousContainerIntersecting = isContainerIntersectingNow;
      if (callReInit) {
        reInitController?.reinit();
      }
    }
  }

  function resizeHandler(entries: ResizeObserverEntry[]): void {
    let resize = false;

    for (const entry of entries) {
      const newDimensions: SlideDimensions = {
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      };

      const oldDimensions = previousDimensions.get(entry.target);
      if (
        newDimensions.width &&
        newDimensions.height &&
        (oldDimensions?.height !== newDimensions.height ||
          oldDimensions?.width !== newDimensions.width)
      ) {
        previousDimensions.set(entry.target, newDimensions);
        resize = true;
      }
    }

    if (resize) {
      debouncedSetContainerHeight();
    }
  }

  function setContainerHeightAndReInit(): void {
    const {
      slideRegistry,
      options: { axis },
    } = emblaApi.internalEngine();

    if (axis === 'y') {
      return;
    }

    emblaApi.containerNode().style.removeProperty('max-height');

    const selectedIndexes = slideRegistry[emblaApi.selectedScrollSnap()];
    const slides = emblaApi.slideNodes();
    const highest = Math.max(
      ...selectedIndexes.map((i) => slides[i].getBoundingClientRect().height),
    );

    if (!isNaN(highest) && highest > 0) {
      emblaApi.containerNode().style.maxHeight = `${highest}px`;
    }

    reInitController?.reinit();
  }

  const self: AutoSizeType = {
    name: 'autoSize',
    options: {},
    init,
    destroy,
  };
  return self;
}

export default AutoSize;
