import EmblaCarousel, { EmblaCarouselType } from 'embla-carousel';
import { MockedObject, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarouselController } from '../../../src/utils/embla/carousel-controller';
import AutoMediaLoadedInfo from '../../../src/utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info';
import {
  MutationObserverMock,
  callMutationHandler,
  createParent,
  createSlot,
  createSlotHost,
} from '../../test-utils';
import {
  callEmblaHandler,
  createEmblaApiInstance,
  createTestSlideNodes,
} from './test-utils';

vi.mock('embla-carousel', () => ({
  default: vi.fn().mockImplementation(() => {
    return createEmblaApiInstance();
  }),
}));

// Get the nth most recently constructed EmblaAPI instance.
const getEmblaApi = (n = 0): MockedObject<EmblaCarouselType> | null => {
  const constructions = vi.mocked(EmblaCarousel).mock.results;
  const mostRecentResult = constructions[constructions.length - 1 - n] ?? null;
  if (mostRecentResult && mostRecentResult.type === 'return') {
    return vi.mocked(mostRecentResult.value);
  }
  return null;
};

const createRoot = (): HTMLElement => {
  return document.createElement('div');
};

// @vitest-environment jsdom
describe('CarouselController', () => {
  beforeAll(() => {
    vi.stubGlobal('MutationObserver', MutationObserverMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    const carousel = new CarouselController(createRoot(), parent);
    expect(carousel).toBeTruthy();
  });

  it('should construct with slot parent', () => {
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: createTestSlideNodes() });
    const carousel = new CarouselController(host, slot);
    expect(carousel).toBeTruthy();
  });

  it('should destroy', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    const carousel = new CarouselController(createRoot(), parent);

    carousel.destroy();

    expect(getEmblaApi()?.destroy).toBeCalled();
  });

  it('should destroy with slot', () => {
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: createTestSlideNodes() });
    const carousel = new CarouselController(host, slot);

    carousel.destroy();

    expect(getEmblaApi()?.destroy).toBeCalled();
  });

  it('should get slide by index', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    const carousel = new CarouselController(createRoot(), parent);

    getEmblaApi()?.slideNodes.mockReturnValue(children);
    expect(carousel.getSlide(2)).toBe(children[2]);
  });

  it('should get slide by index when index is invalid', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    const carousel = new CarouselController(createRoot(), parent);

    expect(carousel.getSlide(1000)).toBeNull();
  });

  it('should get selected slide', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    const carousel = new CarouselController(createRoot(), parent);

    getEmblaApi()?.slideNodes.mockReturnValue(children);
    getEmblaApi()?.selectedScrollSnap.mockReturnValue(3);
    expect(carousel.getSelectedIndex()).toBe(3);
    expect(carousel.getSelectedSlide()).toBe(children[3]);
  });

  it('should select given slide', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });

    const forceSelectListener = vi.fn();
    parent.addEventListener(
      'advanced-camera-card:carousel:force-select',
      forceSelectListener,
    );

    const carousel = new CarouselController(createRoot(), parent);

    carousel.selectSlide(4);

    expect(getEmblaApi()?.scrollTo).toBeCalledWith(4, false);
    expect(forceSelectListener).toBeCalledWith(
      expect.objectContaining({
        detail: { index: 4, element: children[4] },
      }),
    );
  });

  it('should not select non-existent slide', () => {
    const children = createTestSlideNodes({ n: 10 });
    const parent = createParent({ children: children });

    const forceSelectListener = vi.fn();
    parent.addEventListener(
      'advanced-camera-card:carousel:force-select',
      forceSelectListener,
    );

    const carousel = new CarouselController(createRoot(), parent);

    carousel.selectSlide(11);

    // Should not call scrollTo or fire event because index is out of bounds
    expect(getEmblaApi()?.scrollTo).not.toBeCalled();
    expect(forceSelectListener).not.toBeCalled();
  });

  it('should dispatch select event', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    new CarouselController(createRoot(), parent);

    const selectHandler = vi.fn();
    parent.addEventListener('advanced-camera-card:carousel:select', selectHandler);

    getEmblaApi()?.selectedScrollSnap.mockReturnValue(6);
    getEmblaApi()?.slideNodes.mockReturnValue(children);
    callEmblaHandler(getEmblaApi(), 'select');

    expect(selectHandler).toBeCalledWith(
      expect.objectContaining({
        detail: {
          index: 6,
          element: children[6],
        },
      }),
    );
  });

  it('should not dispatch anything with an invalid scroll snap', () => {
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    new CarouselController(createRoot(), parent);

    const selectHandler = vi.fn();
    parent.addEventListener('advanced-camera-card:carousel:select', selectHandler);

    getEmblaApi()?.selectedScrollSnap.mockReturnValue(1000);
    getEmblaApi()?.slideNodes.mockReturnValue(children);
    callEmblaHandler(getEmblaApi(), 'init');
    callEmblaHandler(getEmblaApi(), 'select');
    callEmblaHandler(getEmblaApi(), 'settle');

    expect(selectHandler).not.toBeCalled();
  });

  it('should honor creation options', () => {
    const children = createTestSlideNodes({ n: 1 });
    const root = createRoot();
    const parent = createParent({ children: children });
    const plugins = [AutoMediaLoadedInfo()];

    new CarouselController(root, parent, {
      direction: 'vertical',
      transitionEffect: 'none',
      startIndex: 7,
      dragFree: true,
      loop: true,
      dragEnabled: false,
      plugins: plugins,
      textDirection: 'rtl',
    });

    expect(EmblaCarousel).toBeCalledWith(
      root,
      {
        slides: children,
        axis: 'y',
        duration: 20,
        startIndex: 7,
        dragFree: true,
        loop: true,
        containScroll: 'trimSnaps',
        watchSlides: false,
        watchResize: true,
        watchDrag: false,
        direction: 'rtl',
      },
      plugins,
    );
  });

  it('should include wheel plugin when slides > 1', () => {
    const children = createTestSlideNodes();
    const root = createRoot();
    const parent = createParent({ children: children });
    new CarouselController(root, parent);

    expect(EmblaCarousel).toBeCalledWith(
      root,
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          name: 'wheelGestures',
        }),
      ]),
    );
  });

  it('should not include wheel plugin when wheelScrolling is false', () => {
    const children = createTestSlideNodes();
    const root = createRoot();
    const parent = createParent({ children: children });
    new CarouselController(root, parent, { wheelScrolling: false });

    // Verify WheelGesturesPlugin is NOT present
    expect(EmblaCarousel).toBeCalledWith(
      root,
      expect.anything(),
      expect.not.arrayContaining([
        expect.objectContaining({
          name: 'wheelGestures',
        }),
      ]),
    );
  });

  it('should reinit carousel when children are added', () => {
    const children = createTestSlideNodes();
    const root = createRoot();
    const parent = createParent({ children: children });
    new CarouselController(root, parent);

    expect(EmblaCarousel).toBeCalledTimes(1);

    const originalEmblaApi = getEmblaApi();
    expect(originalEmblaApi).toBeTruthy();

    originalEmblaApi?.slideNodes.mockReturnValue(children);
    const newChild = document.createElement('div');
    parent.appendChild(newChild);
    callMutationHandler();

    // Should call reInit instead of destroy/recreate
    expect(originalEmblaApi?.reInit).toBeCalledWith({
      slides: [...children, newChild],
    });

    // Should still be same carousel instance (no new creation)
    expect(EmblaCarousel).toBeCalledTimes(1);
  });

  it('should not recreate carousel when children have not changed', () => {
    const children = createTestSlideNodes();
    const root = createRoot();
    const parent = createParent({ children: children });
    new CarouselController(root, parent);

    expect(EmblaCarousel).toBeCalledTimes(1);

    const originalEmblaApi = getEmblaApi();
    expect(originalEmblaApi).toBeTruthy();

    originalEmblaApi?.slideNodes.mockReturnValue(children);
    callMutationHandler();

    expect(originalEmblaApi?.destroy).not.toBeCalled();
    expect(getEmblaApi()).toBe(originalEmblaApi);

    expect(EmblaCarousel).toBeCalledTimes(1);
  });

  it('should reinit carousel when children are added to slot', () => {
    const children = createTestSlideNodes();
    const slot = createSlot();
    const host = createSlotHost({ slot: slot, children: children });

    new CarouselController(host, slot);

    expect(EmblaCarousel).toBeCalledTimes(1);

    const originalEmblaApi = getEmblaApi();
    expect(originalEmblaApi).toBeTruthy();

    originalEmblaApi?.slideNodes.mockReturnValue(children);

    const newChild = document.createElement('div');
    host.appendChild(newChild);
    slot.dispatchEvent(new Event('slotchange'));

    // Should call reInit instead of destroy/recreate
    expect(originalEmblaApi?.reInit).toBeCalledWith({
      slides: [...children, newChild],
    });

    // Should still be same carousel instance (no new creation)
    expect(EmblaCarousel).toBeCalledTimes(1);
  });
});
