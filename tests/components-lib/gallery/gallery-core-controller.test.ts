import { LitElement } from 'lit';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GalleryColumnCountRoundMethod,
  GalleryCoreController,
} from '../../../src/components-lib/gallery/gallery-core-controller';
import { GalleryExtendEvent } from '../../../src/components/gallery/types';
import { scrollIntoView } from '../../../src/utils/scroll';
import { sleep } from '../../../src/utils/sleep';
import {
  callIntersectionHandler,
  callResizeHandler,
  createLitElement,
  createSlot,
  createSlotHost,
  createTouch,
  createTouchEvent,
  flushPromises,
  IntersectionObserverMock,
  ResizeObserverMock,
} from '../../test-utils';

vi.mock('lodash-es', async () => {
  return {
    ...(await vi.importActual('lodash-es')),
    throttle: vi.fn((fn) => fn),
  };
});

vi.mock('../../../src/utils/sleep');
vi.mock('../../../src/utils/scroll');

// @vitest-environment jsdom
describe('GalleryCoreController', () => {
  const createController = (options?: {
    host?: LitElement;
    getSlot?: () => HTMLSlotElement | null;
    getSentinelBottom?: () => HTMLElement | null;
    showLoaderTopCallback?: (show: boolean) => void;
    showSentinelBottomCallback?: (show: boolean) => void;
  }) => {
    return new GalleryCoreController(
      options?.host ?? createLitElement(),
      options?.getSlot ?? (() => null),
      options?.getSentinelBottom ?? (() => null),
      options?.showLoaderTopCallback ?? (() => null),
      options?.showSentinelBottomCallback ?? (() => null),
    );
  };

  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should add controller', () => {
    const host = createLitElement();
    const controller = createController({ host });
    expect(controller).toBeInstanceOf(GalleryCoreController);
    expect(host.addController).toBeCalledWith(controller);
  });

  it('should remove controller', () => {
    const host = createLitElement();
    const controller = createController({ host });
    expect(controller).toBeInstanceOf(GalleryCoreController);
    controller.removeController();
    expect(host.removeController).toBeCalledWith(controller);
  });

  it('should remove controller', () => {
    const host = createLitElement();
    const controller = createController({ host });
    expect(controller).toBeInstanceOf(GalleryCoreController);
    controller.removeController();
    expect(host.removeController).toBeCalledWith(controller);
  });

  describe('should observe sentintel when host updated', () => {
    it('should disconnect and observe sentinel when valid sentinel exists', () => {
      const sentinel = document.createElement('div');
      const getSentinelBottom = vi.fn(() => sentinel);
      const host = createLitElement();

      const controller = createController({
        host,
        getSentinelBottom,
      });

      controller.hostUpdated();

      expect(
        vi.mocked(IntersectionObserver).mock.results[0].value.disconnect,
      ).toBeCalled();
      expect(
        vi.mocked(IntersectionObserver).mock.results[0].value.observe,
      ).toBeCalledWith(sentinel);
    });

    it('should not observe when sentinel is null', () => {
      const getSentinelBottom = vi.fn(() => null);
      const host = createLitElement();

      const controller = createController({
        host,
        getSentinelBottom,
      });

      controller.hostUpdated();

      expect(
        vi.mocked(IntersectionObserver).mock.results[0].value.disconnect,
      ).toBeCalled();
      expect(
        vi.mocked(IntersectionObserver).mock.results[0].value.observe,
      ).not.toBeCalled();
    });
  });

  it('should attach listeners on connect', () => {
    const host = createLitElement();
    host.addEventListener = vi.fn();
    const controller = createController({ host });

    controller.hostConnected();

    expect(vi.mocked(ResizeObserver).mock.results[0].value.observe).toBeCalledWith(host);
    expect(host.addEventListener).toBeCalledWith('wheel', expect.anything(), {
      passive: true,
    });
    expect(host.addEventListener).toBeCalledWith('touchstart', expect.anything(), {
      passive: true,
    });
    expect(host.addEventListener).toBeCalledWith('touchend', expect.anything());
    expect(host.requestUpdate).toBeCalled();
  });

  it('should detach listeners on disconnect', () => {
    const host = createLitElement();
    host.removeEventListener = vi.fn();
    const controller = createController({ host });

    controller.hostDisconnected();

    expect(vi.mocked(ResizeObserver).mock.results[0].value.disconnect).toBeCalled();
    expect(
      vi.mocked(IntersectionObserver).mock.results[0].value.disconnect,
    ).toBeCalled();
    expect(host.removeEventListener).toBeCalledWith('wheel', expect.anything());
    expect(host.removeEventListener).toBeCalledWith('touchstart', expect.anything());
    expect(host.removeEventListener).toBeCalledWith('touchend', expect.anything());
  });

  describe('should set the number of columns', () => {
    it('should update columns based on columnWidth and host width', () => {
      const host = createLitElement();
      Object.defineProperty(host, 'clientWidth', { value: 492 });

      const controller = createController({ host });

      controller.setOptions({ columnWidth: 250 });

      expect(host.style.getPropertyValue('--advanced-camera-card-gallery-columns')).toBe(
        '1',
      );
    });

    it('should calculate at least 1 column', () => {
      const host = createLitElement();
      Object.defineProperty(host, 'clientWidth', { value: 100 });

      const controller = createController({ host });

      controller.setOptions({ columnWidth: 200 });

      expect(host.style.getPropertyValue('--advanced-camera-card-gallery-columns')).toBe(
        '1',
      );
    });

    describe('should respect column count round method', () => {
      it.each([
        ['ceil' as const, 2],
        ['floor' as const, 1],
      ])(
        '%s',
        async (
          columnCountRoundMethod: GalleryColumnCountRoundMethod,
          expectedColumns: number,
        ) => {
          const host = createLitElement();
          Object.defineProperty(host, 'clientWidth', { value: 100 });

          const controller = createController({ host });

          controller.setOptions({ columnWidth: 51, columnCountRoundMethod });

          expect(
            host.style.getPropertyValue('--advanced-camera-card-gallery-columns'),
          ).toBe(String(expectedColumns));
        },
      );
    });

    it('should not update columns when columnWidth is not set', () => {
      const host = createLitElement();
      Object.defineProperty(host, 'clientWidth', { value: 500 });

      const controller = createController({ host });

      controller.setOptions({});

      expect(host.style.getPropertyValue('--advanced-camera-card-gallery-columns')).toBe(
        '',
      );
    });

    it('should update columns on resize', () => {
      const host = createLitElement();
      const controller = createController({ host });
      controller.setOptions({ columnWidth: 250 });

      const width = 1000;
      Object.defineProperty(host, 'clientWidth', { value: width });
      callResizeHandler([{ target: host, width, height: 200 }]);

      expect(host.style.getPropertyValue('--advanced-camera-card-gallery-columns')).toBe(
        '4',
      );
    });
  });

  describe('should extend gallery', () => {
    describe('should extend gallery up', () => {
      describe('should extend gallery up with wheel events', () => {
        it('should extend up with wheel event upwards', async () => {
          const host = createLitElement();
          host.scrollTop = 0;
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          const extendUpCallback = vi
            .fn()
            .mockImplementation((ev: CustomEvent<GalleryExtendEvent>) => {
              expect(showLoaderTop).toHaveBeenLastCalledWith(true);

              ev.detail.resolve();
            });
          host.addEventListener(
            'advanced-camera-card:gallery:extend:up',
            extendUpCallback,
          );

          host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));

          await flushPromises();
          expect(showLoaderTop).toHaveBeenLastCalledWith(false);
        });

        it('should not extend up with wheel event when not at top of component', async () => {
          const host = createLitElement();
          host.scrollTop = 100;
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));

          expect(showLoaderTop).not.toHaveBeenCalled();
        });

        it('should not extend up with wheel event downwards', async () => {
          const host = createLitElement();
          host.scrollTop = 0;
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          host.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));

          expect(showLoaderTop).not.toHaveBeenCalled();
        });
      });

      describe('should extend gallery up with touch events', () => {
        it('should extend up with touch event upwards', async () => {
          const host = createLitElement();
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          const extendUpCallback = vi
            .fn()
            .mockImplementation((ev: CustomEvent<GalleryExtendEvent>) => {
              expect(showLoaderTop).toHaveBeenLastCalledWith(true);

              ev.detail.resolve();
            });

          host.addEventListener(
            'advanced-camera-card:gallery:extend:up',
            extendUpCallback,
          );

          host.dispatchEvent(
            createTouchEvent('touchstart', { touches: [createTouch({ screenY: 0 })] }),
          );
          host.dispatchEvent(
            createTouchEvent('touchend', {
              changedTouches: [createTouch({ screenY: 100 })],
            }),
          );

          await flushPromises();
          expect(showLoaderTop).toHaveBeenLastCalledWith(false);
        });

        it('should not extend up with multiple touches', async () => {
          const host = createLitElement();
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          host.dispatchEvent(
            createTouchEvent('touchstart', {
              touches: [createTouch({ screenY: 0 }), createTouch({ screenY: 0 })],
            }),
          );
          host.dispatchEvent(
            createTouchEvent('touchend', {
              changedTouches: [createTouch({ screenY: 100 })],
            }),
          );

          await flushPromises();
          expect(showLoaderTop).not.toBeCalled();
        });

        it('should not extend up with touch when when not at top of component', async () => {
          const host = createLitElement();
          host.scrollTop = 100;
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          host.dispatchEvent(
            createTouchEvent('touchstart', {
              touches: [createTouch({ screenY: 0 }), createTouch({ screenY: 0 })],
            }),
          );
          host.dispatchEvent(
            createTouchEvent('touchend', {
              changedTouches: [createTouch({ screenY: 100 })],
            }),
          );

          await flushPromises();
          expect(showLoaderTop).not.toBeCalled();
        });

        it('should not extend up with touch when touches moved downwards', async () => {
          const host = createLitElement();
          const showLoaderTop = vi.fn();
          const controller = createController({
            host,
            showLoaderTopCallback: showLoaderTop,
          });

          controller.setOptions({ extendUp: true });
          controller.hostConnected();

          host.dispatchEvent(
            createTouchEvent('touchstart', {
              touches: [createTouch({ screenY: 100 })],
            }),
          );
          host.dispatchEvent(
            createTouchEvent('touchend', {
              changedTouches: [createTouch({ screenY: 0 })],
            }),
          );

          await flushPromises();
          expect(showLoaderTop).not.toBeCalled();
        });
      });

      it('should not extend when extending up is disabled', async () => {
        const host = createLitElement();
        const showLoaderTop = vi.fn();
        const controller = createController({
          host,
          showLoaderTopCallback: showLoaderTop,
        });

        controller.setOptions({ extendUp: false });
        controller.hostConnected();

        host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));

        expect(showLoaderTop).not.toHaveBeenCalled();
      });

      it('should not artifically sleep if extend up call takes too long', async () => {
        vi.useFakeTimers();

        const host = createLitElement();
        host.scrollTop = 0;
        const showLoaderTop = vi.fn();
        const controller = createController({
          host,
          showLoaderTopCallback: showLoaderTop,
        });

        controller.setOptions({ extendUp: true });
        controller.hostConnected();

        const extendUpCallback = vi
          .fn()
          .mockImplementation((ev: CustomEvent<GalleryExtendEvent>) => {
            vi.advanceTimersByTime(10000);
            ev.detail.resolve();
          });

        host.addEventListener(
          'advanced-camera-card:gallery:extend:up',
          extendUpCallback,
        );

        host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));

        await flushPromises();
        expect(sleep).not.toHaveBeenCalled();
      });
    });

    describe('should extend gallery down', () => {
      it('should extend down when sentinel intersects', async () => {
        const host = createLitElement();
        const showSentinelBottom = vi.fn();
        const controller = createController({
          host,
          showSentinelBottomCallback: showSentinelBottom,
        });

        controller.setOptions({ extendDown: true });
        controller.hostConnected();

        const extendDownCallback = vi
          .fn()
          .mockImplementation((ev: CustomEvent<GalleryExtendEvent>) => {
            expect(showSentinelBottom).toHaveBeenLastCalledWith(false);

            ev.detail.resolve();
          });
        host.addEventListener(
          'advanced-camera-card:gallery:extend:down',
          extendDownCallback,
        );

        callIntersectionHandler(true);

        await flushPromises();
        expect(showSentinelBottom).toHaveBeenLastCalledWith(false);
      });

      it('should not extend down when sentinel does not intersect', async () => {
        const host = createLitElement();
        const showSentinelBottom = vi.fn();
        const controller = createController({
          host,
          showSentinelBottomCallback: showSentinelBottom,
        });

        controller.setOptions({ extendUp: true });
        controller.hostConnected();

        callIntersectionHandler(false);

        expect(showSentinelBottom).not.toHaveBeenCalled();
      });

      it('should not extend when extending down is disabled', async () => {
        const host = createLitElement();
        const showSentinelBottom = vi.fn();
        const controller = createController({
          host,
          showSentinelBottomCallback: showSentinelBottom,
        });

        controller.setOptions({ extendUp: false });
        controller.hostConnected();

        callIntersectionHandler(true);

        expect(showSentinelBottom).not.toHaveBeenCalled();
      });
    });
  });

  describe('should handle content change', () => {
    describe('should scroll selected into view', () => {
      it('should scroll selected into view on first load', async () => {
        const selectedChild = document.createElement('div');
        selectedChild.setAttribute('selected', '');

        const slot = createSlot();
        const host = createSlotHost({
          slot,
          children: [
            document.createElement('div'),
            document.createElement('div'),
            selectedChild,
          ],
        });

        const controller = createController({
          host,
          getSlot: () => slot,
        });
        controller.updateContents();

        expect(scrollIntoView).toBeCalledWith(selectedChild, {
          boundary: host,
          block: 'center',
        });
      });

      it('should do nothing on subsequent contents changes', async () => {
        const selectedChild = document.createElement('div');
        selectedChild.setAttribute('selected', '');

        const slot = createSlot();
        const host = createSlotHost({
          slot,
          children: [
            document.createElement('div'),
            document.createElement('div'),
            selectedChild,
          ],
        });

        const controller = createController({
          host,
          getSlot: () => slot,
        });
        controller.updateContents();
        controller.updateContents();
        controller.updateContents();

        expect(scrollIntoView).toBeCalledTimes(1);
      });

      it('should do nothing without a selected element', async () => {
        const slot = createSlot();
        const host = createSlotHost({
          slot,
          children: [
            document.createElement('div'),
            document.createElement('div'),
            document.createElement('div'),
          ],
        });

        const controller = createController({
          host,
          getSlot: () => slot,
        });
        controller.updateContents();

        expect(scrollIntoView).not.toBeCalled();
      });
    });

    it('should show bottom sentintel if contents change', async () => {
      const slot = createSlot();
      const host = createSlotHost({
        slot,
      });

      const showSentinelBottom = vi.fn();
      const controller = createController({
        host,
        getSlot: () => slot,
        showSentinelBottomCallback: showSentinelBottom,
      });

      controller.updateContents();

      expect(showSentinelBottom).toBeCalledWith(true);
    });

    it('should do nothing without slot', async () => {
      const slot = createSlot();
      const host = createSlotHost({
        slot,
      });

      const showSentinelBottom = vi.fn();
      const controller = createController({
        host,
        showSentinelBottomCallback: showSentinelBottom,
      });

      controller.updateContents();

      expect(showSentinelBottom).not.toBeCalled();
      expect(scrollIntoView).not.toBeCalled();
    });
  });
});
