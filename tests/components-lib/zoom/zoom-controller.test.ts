import Panzoom, { PanzoomEventDetail, PanzoomObject } from '@dermotduffy/panzoom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockClear } from 'vitest-mock-extended';
import { ZoomController } from '../../../src/components-lib/zoom/zoom-controller';
import {
  ResizeObserverMock,
  createTouch,
  createTouchEvent,
  requestAnimationFrameMock,
} from '../../test-utils';

vi.mock('@dermotduffy/panzoom');
vi.mock('lodash-es', () => ({
  round: vi.fn((fn) => fn),
  throttle: vi.fn((fn) => fn),
}));

// https://github.com/jsdom/jsdom/issues/2527
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).PointerEvent = MouseEvent;

const triggerResizeObserver = (): void => {
  const resizeObserverTrigger = vi.mocked(global.ResizeObserver).mock.calls[0][0];
  resizeObserverTrigger([], mock<ResizeObserver>());
};

const setElementToDefaultCardSize = (element: HTMLElement, multiple?: number): void => {
  element.getBoundingClientRect = vi.fn().mockReturnValue({
    width: 492 * (multiple ?? 1),
    height: 276.75 * (multiple ?? 1),
  });
};

// @vitest-environment jsdom
describe('ZoomController', () => {
  const mediaSpy = vi.spyOn(window, 'matchMedia');

  const createMockPanZoom = (): PanzoomObject => {
    const panzoom = mock<PanzoomObject>();
    panzoom.getScale.mockReturnValue(1.0);
    panzoom.getPan.mockReturnValue({ x: 0, y: 0 });
    return panzoom;
  };

  const createAndRegisterZoom = (element: HTMLElement): ZoomController => {
    const zoom = new ZoomController(element);
    zoom.activate();
    return zoom;
  };

  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    window.requestAnimationFrame = requestAnimationFrameMock;
  });

  beforeEach(() => {
    vi.mocked(Panzoom).mockReset();
    vi.mocked(global.ResizeObserver).mockClear();
    mediaSpy.mockReturnValue(<MediaQueryList>{ matches: true });
  });

  it('should be creatable', () => {
    const element = document.createElement('div');
    const zoom = new ZoomController(element);
    expect(zoom).toBeTruthy();
  });

  describe('should pan and zoom', () => {
    it('should respond with pointer', () => {
      const element = document.createElement('div');

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      createAndRegisterZoom(element);

      // Won't zoom without control key.
      const ev_1 = new WheelEvent('wheel', { bubbles: false, deltaY: -120 });
      element.dispatchEvent(ev_1);
      expect(panzoom.zoomWithWheel).not.toBeCalled();

      const ev_2 = new WheelEvent('wheel', {
        bubbles: false,
        deltaY: -120,
        ctrlKey: true,
      });
      element.dispatchEvent(ev_2);
      expect(panzoom.zoomWithWheel).toBeCalledWith(ev_2);

      panzoom.getScale = vi.fn().mockReturnValue(1.2);

      const ev_3 = new PointerEvent('pointerdown');
      element.dispatchEvent(ev_3);
      expect(panzoom.handleDown).toBeCalledWith(ev_3);

      const ev_4 = new PointerEvent('pointermove');
      element.dispatchEvent(ev_4);
      expect(panzoom.handleMove).toBeCalledWith(ev_4);

      const ev_5 = new PointerEvent('pointerup');
      element.dispatchEvent(ev_5);
      expect(panzoom.handleUp).toBeCalledWith(ev_5);
    });

    it('should not respond to pointer when not zoomed', () => {
      const element = document.createElement('div');

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      createAndRegisterZoom(element);

      const ev_1 = new PointerEvent('pointerdown');
      element.dispatchEvent(ev_1);
      expect(panzoom.handleDown).not.toBeCalledWith(ev_1);

      const ev_2 = new PointerEvent('pointermove');
      element.dispatchEvent(ev_2);
      expect(panzoom.handleDown).not.toBeCalledWith(ev_2);

      const ev_3 = new PointerEvent('pointerup');
      element.dispatchEvent(ev_3);
      expect(panzoom.handleDown).not.toBeCalledWith(ev_3);
    });

    it('should respond with touch', () => {
      mediaSpy.mockReturnValue(<MediaQueryList>{ matches: false });

      const element = document.createElement('div');

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      createAndRegisterZoom(element);

      const ev_1 = createTouchEvent('touchstart', {
        touches: [createTouch({ target: element }), createTouch({ target: element })],
      });
      element.dispatchEvent(ev_1);
      expect(panzoom.handleDown).toBeCalledWith(ev_1);

      panzoom.getScale = vi.fn().mockReturnValue(1.2);

      const ev_3 = createTouchEvent('touchstart');
      element.dispatchEvent(ev_3);
      expect(panzoom.handleDown).toBeCalledWith(ev_3);

      const ev_4 = createTouchEvent('touchmove');
      element.dispatchEvent(ev_4);
      expect(panzoom.handleMove).toBeCalledWith(ev_4);

      const ev_5 = createTouchEvent('touchend');
      element.dispatchEvent(ev_5);
      expect(panzoom.handleUp).toBeCalledWith(ev_5);
    });
  });

  it('should ignore click after pointerdown', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    outer.appendChild(inner);
    const clickHandler = vi.fn();
    outer.addEventListener('click', clickHandler);

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(inner);

    // Simulate being zoomed in.
    panzoom.getScale = vi.fn().mockReturnValue(1.2);

    // A click on its own will be fine.
    const click_1 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_1);
    expect(clickHandler).toBeCalledTimes(1);

    // A click after a pointerdown will be ignored.
    const pointerdown_1 = new PointerEvent('pointerdown');
    inner.dispatchEvent(pointerdown_1);

    const click_2 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_2);

    // Click will have been ignored.
    //expect(clickHandler).toBeCalledTimes(1);

    // Simulate being zoomed out.
    panzoom.getScale = vi.fn().mockReturnValue(1.0);
    const pointerdown_2 = new PointerEvent('pointerdown');
    inner.dispatchEvent(pointerdown_2);

    const click_3 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_3);

    // Click will have been processed.
    expect(clickHandler).toBeCalledTimes(2);
  });

  it('deactivate should remove event handlers', () => {
    const element = document.createElement('div');

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(element).deactivate();

    const ev_1 = new WheelEvent('wheel', {
      bubbles: false,
      deltaY: -120,
      ctrlKey: true,
    });
    element.dispatchEvent(ev_1);
    expect(panzoom.zoomWithWheel).not.toBeCalled();
  });

  describe('should fire events', () => {
    it('on zoom/unzoom', () => {
      const element = document.createElement('div');
      const zoomedFunc = vi.fn();
      const unzoomedFunc = vi.fn();
      element.addEventListener('advanced-camera-card:zoom:zoomed', zoomedFunc);
      element.addEventListener('advanced-camera-card:zoom:unzoomed', unzoomedFunc);

      vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
      createAndRegisterZoom(element);

      const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
        detail: {
          x: 0,
          y: 0,
          scale: 1.2,
          isSVG: false,
          originalEvent: new PointerEvent('pointermove'),
        },
      });
      element.dispatchEvent(ev_1);
      expect(zoomedFunc).toBeCalled();
      expect(unzoomedFunc).not.toBeCalled();

      const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
        detail: {
          x: 0,
          y: 0,
          scale: 1,
          isSVG: false,
          originalEvent: new PointerEvent('pointermove'),
        },
      });
      element.dispatchEvent(ev_2);
      expect(unzoomedFunc).toBeCalled();
    });

    it('when state has not changed or spurious events received', () => {
      const element = document.createElement('div');
      const zoomedFunc = vi.fn();
      const unzoomedFunc = vi.fn();
      element.addEventListener('advanced-camera-card:zoom:zoomed', zoomedFunc);
      element.addEventListener('advanced-camera-card:zoom:unzoomed', unzoomedFunc);

      vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
      createAndRegisterZoom(element);

      const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
        detail: {
          x: 0,
          y: 0,
          scale: 1,
          isSVG: false,
          originalEvent: new PointerEvent('pointermove'),
        },
      });
      element.dispatchEvent(ev_1);

      // Unzoomed event with scale === 1, this._zoomed will already be false.
      expect(unzoomedFunc).not.toBeCalled();
      expect(zoomedFunc).not.toBeCalled();

      const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
        detail: {
          x: 0,
          y: 0,
          scale: 1.2,
          isSVG: false,
          originalEvent: new PointerEvent('pointermove'),
        },
      });
      element.dispatchEvent(ev_2);
      expect(zoomedFunc).toBeCalledTimes(1);
      expect(unzoomedFunc).not.toBeCalled();

      // Another call when already zoomed will be ignored.
      element.dispatchEvent(ev_2);
      expect(zoomedFunc).toBeCalledTimes(1);
    });

    describe('on default/non-default', () => {
      it('without explicit default', () => {
        const element = document.createElement('div');
        setElementToDefaultCardSize(element);

        const changeFunc = vi.fn();
        element.addEventListener('advanced-camera-card:zoom:change', changeFunc);

        vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
        createAndRegisterZoom(element);

        const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 0,
            y: 0,
            scale: 1.2,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        });
        element.dispatchEvent(ev_1);

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: false }),
          }),
        );

        const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 50,
            y: 50,
            scale: 1,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        });
        element.dispatchEvent(ev_2);

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: true }),
          }),
        );
      });

      it('with complete explicit default', () => {
        const element = document.createElement('div');
        setElementToDefaultCardSize(element);

        const changeFunc = vi.fn();
        element.addEventListener('advanced-camera-card:zoom:change', changeFunc);

        vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
        const controller = createAndRegisterZoom(element);
        controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

        const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 50,
            y: 50,
            scale: 1,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        });
        element.dispatchEvent(ev_1);

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: false }),
          }),
        );

        const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 115.62,
            y: 63.6525,
            scale: 2,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        });
        element.dispatchEvent(ev_2);

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: true }),
          }),
        );
      });

      it('with partial explicit default', () => {
        const element = document.createElement('div');
        setElementToDefaultCardSize(element);

        const changeFunc = vi.fn();
        element.addEventListener('advanced-camera-card:zoom:change', changeFunc);

        vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
        const controller = createAndRegisterZoom(element);

        const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 51,
            y: 51,
            scale: 2,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        });
        element.dispatchEvent(ev_1);

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: false }),
          }),
        );

        controller.setDefaultSettings({});

        const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 50,
            y: 50,
            scale: 1,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        });
        element.dispatchEvent(ev_2);

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: true }),
          }),
        );
      });
    });
  });

  describe('should automatically set correct zoom', () => {
    it('with start', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      const controller = new ZoomController(element);
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      // Controller was not activated, config setting will not update pan/zoom.
      expect(panzoom.zoom).not.toBeCalled();
      expect(panzoom.pan).not.toBeCalled();

      controller.activate();
      expect(Panzoom).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          contain: 'outside',
          cursor: undefined,
          maxScale: 10,
          minScale: 1,
          noBind: true,
          touchAction: '',
          startScale: 2,
          startX: 115.62,
          startY: 63.6525,
        }),
      );
    });

    it('with set of default config', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      triggerResizeObserver();

      expect(panzoom.zoom).toBeCalledWith(2, { animate: false });
      expect(panzoom.pan).toBeCalledWith(115.62, 63.6525, {
        animate: true,
        duration: 100,
      });
    });

    it('with set of config when a default is already set', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);

      // This call will do nothing since this is what zoom/pan already are.
      controller.setDefaultSettings({ zoom: 1, pan: { x: 0, y: 0 } });

      expect(panzoom.zoom).not.toBeCalled();
      expect(panzoom.pan).not.toBeCalled();

      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      expect(panzoom.zoom).toHaveBeenNthCalledWith(1, 2, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(1, 115.62, 63.6525, {
        animate: true,
        duration: 100,
      });

      controller.setSettings({ zoom: 3, pan: { x: 5, y: 6 } });

      expect(panzoom.zoom).toHaveBeenNthCalledWith(2, 3, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(2, 147.6, 81.18, {
        animate: true,
        duration: 100,
      });
    });

    it('with repeated calls with same values', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);

      controller.setSettings({ zoom: 1 });
      expect(panzoom.zoom).not.toHaveBeenCalled();

      controller.setSettings({ pan: { x: 50, y: 50 } });
      expect(panzoom.zoom).not.toHaveBeenCalled();

      controller.setSettings({ zoom: 1, pan: { x: 50, y: 50 } });
      expect(panzoom.zoom).not.toHaveBeenCalled();

      controller.setSettings({});
      expect(panzoom.zoom).not.toHaveBeenCalled();

      controller.setSettings({ zoom: 2 });

      expect(panzoom.zoom).toBeCalledTimes(1);
      expect(panzoom.pan).toBeCalledTimes(1);
      expect(panzoom.zoom).toHaveBeenNthCalledWith(1, 2, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(1, 0, 0, {
        animate: true,
        duration: 100,
      });

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 0, y: 0 });
      controller.setSettings({ zoom: 2 });

      expect(panzoom.zoom).toBeCalledTimes(1);
      expect(panzoom.pan).toBeCalledTimes(1);
    });

    it('when config is set to empty', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });
      mockClear(panzoom);

      controller.setSettings({});

      // Should fall back to default.
      expect(panzoom.zoom).toBeCalledWith(2, { animate: false });
      expect(panzoom.pan).toBeCalledWith(115.62, 63.6525, {
        animate: true,
        duration: 100,
      });
    });

    it('when resized', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      expect(panzoom.zoom).toHaveBeenNthCalledWith(1, 2, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(1, 115.62, 63.6525, {
        animate: true,
        duration: 100,
      });

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 3, y: 4 });

      setElementToDefaultCardSize(element);
      triggerResizeObserver();

      expect(panzoom.zoom).toHaveBeenNthCalledWith(2, 2, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(2, 57.81, 31.82625, {
        animate: true,
        duration: 100,
      });
    });

    it('when not yet activated', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      setElementToDefaultCardSize(element);

      new ZoomController(element);

      triggerResizeObserver();

      expect(panzoom.zoom).not.toBeCalled();
      expect(panzoom.pan).not.toBeCalled();
    });

    it('when element has no size', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = document.createElement('div');
      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 0,
        height: 0,
      });
      createAndRegisterZoom(element);

      triggerResizeObserver();

      expect(panzoom.zoom).not.toBeCalled();
      expect(panzoom.pan).not.toBeCalled();
    });
  });

  it('should set touch action on zoom/unzoom', () => {
    const element = document.createElement('div');
    vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());

    createAndRegisterZoom(element);

    const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
      detail: {
        x: 0,
        y: 0,
        scale: 1.2,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_1);
    expect(element.style.touchAction).toBe('none');

    const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomchange', {
      detail: {
        x: 0,
        y: 0,
        scale: 1,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_2);
    expect(element.style.touchAction).toBeFalsy();
  });
});
