import Panzoom, {
  type PanzoomEventDetail,
  type PanzoomObject,
} from '@dermotduffy/panzoom';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
  type Mock,
} from 'vitest';
import { mock, mockClear } from 'vitest-mock-extended';

import { ZoomController } from '../../../src/components-lib/zoom/zoom-controller';
import {
  createTouch,
  createTouchEvent,
  requestAnimationFrameMock,
  ResizeObserverMock,
  stubMatchMedia,
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

// The controller only activates against an attached element.
const createAttachedElement = (): HTMLElement => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
};

// jsdom doesn't layout, so layout sizes must be set manually.
const setElementToDefaultCardSize = (element: HTMLElement, multiple?: number): void => {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    value: 492 * (multiple ?? 1),
  });
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: 276.75 * (multiple ?? 1),
  });
};

// @vitest-environment jsdom
describe('ZoomController', () => {
  let mediaSpy: Mock;

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
    mediaSpy = stubMatchMedia();
    mediaSpy.mockReturnValue(<MediaQueryList>{ matches: true });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('should be creatable', () => {
    const element = createAttachedElement();
    const zoom = new ZoomController(element);
    expect(zoom).toBeTruthy();
  });

  describe('should pan and zoom', () => {
    it('should respond with pointer', () => {
      const element = createAttachedElement();

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      createAndRegisterZoom(element);

      // Won't zoom without control key.
      const ev_1 = new WheelEvent('wheel', { bubbles: false, deltaY: -120 });
      element.dispatchEvent(ev_1);
      expect(panzoom.zoomWithWheel).not.toHaveBeenCalled();

      const ev_2 = new WheelEvent('wheel', {
        bubbles: false,
        deltaY: -120,
        ctrlKey: true,
      });
      element.dispatchEvent(ev_2);
      expect(panzoom.zoomWithWheel).toHaveBeenCalledWith(ev_2);

      panzoom.getScale = vi.fn().mockReturnValue(1.2);

      const ev_3 = new PointerEvent('pointerdown');
      element.dispatchEvent(ev_3);
      expect(panzoom.handleDown).toHaveBeenCalledWith(ev_3);

      const ev_4 = new PointerEvent('pointermove');
      element.dispatchEvent(ev_4);
      expect(panzoom.handleMove).toHaveBeenCalledWith(ev_4);

      const ev_5 = new PointerEvent('pointerup');
      element.dispatchEvent(ev_5);
      expect(panzoom.handleUp).toHaveBeenCalledWith(ev_5);
    });

    it('should not respond to pointer when not zoomed', () => {
      const element = createAttachedElement();

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      createAndRegisterZoom(element);

      const ev_1 = new PointerEvent('pointerdown');
      element.dispatchEvent(ev_1);
      expect(panzoom.handleDown).not.toHaveBeenCalledWith(ev_1);

      const ev_2 = new PointerEvent('pointermove');
      element.dispatchEvent(ev_2);
      expect(panzoom.handleDown).not.toHaveBeenCalledWith(ev_2);

      const ev_3 = new PointerEvent('pointerup');
      element.dispatchEvent(ev_3);
      expect(panzoom.handleDown).not.toHaveBeenCalledWith(ev_3);
    });

    it('should respond with touch', () => {
      mediaSpy.mockReturnValue(<MediaQueryList>{ matches: false });

      const element = createAttachedElement();

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      createAndRegisterZoom(element);

      const ev_1 = createTouchEvent('touchstart', {
        touches: [createTouch({ target: element }), createTouch({ target: element })],
      });
      element.dispatchEvent(ev_1);
      expect(panzoom.handleDown).toHaveBeenCalledWith(ev_1);

      panzoom.getScale = vi.fn().mockReturnValue(1.2);

      const ev_3 = createTouchEvent('touchstart');
      element.dispatchEvent(ev_3);
      expect(panzoom.handleDown).toHaveBeenCalledWith(ev_3);

      const ev_4 = createTouchEvent('touchmove');
      element.dispatchEvent(ev_4);
      expect(panzoom.handleMove).toHaveBeenCalledWith(ev_4);

      const ev_5 = createTouchEvent('touchend');
      element.dispatchEvent(ev_5);
      expect(panzoom.handleUp).toHaveBeenCalledWith(ev_5);
    });
  });

  it('should ignore click after pointerdown', () => {
    const outer = createAttachedElement();
    const inner = createAttachedElement();
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
    expect(clickHandler).toHaveBeenCalledTimes(1);

    // A click after a pointerdown will be ignored.
    const pointerdown_1 = new PointerEvent('pointerdown');
    inner.dispatchEvent(pointerdown_1);

    const click_2 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_2);

    // Click will have been ignored.
    //expect(clickHandler).toHaveBeenCalledTimes(1);

    // Simulate being zoomed out.
    panzoom.getScale = vi.fn().mockReturnValue(1.0);
    const pointerdown_2 = new PointerEvent('pointerdown');
    inner.dispatchEvent(pointerdown_2);

    const click_3 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_3);

    // Click will have been processed.
    expect(clickHandler).toHaveBeenCalledTimes(2);
  });

  it('should stop responding to events after deactivation', () => {
    const element = createAttachedElement();

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(element).deactivate();

    const ev_1 = new WheelEvent('wheel', {
      bubbles: false,
      deltaY: -120,
      ctrlKey: true,
    });
    element.dispatchEvent(ev_1);
    expect(panzoom.zoomWithWheel).not.toHaveBeenCalled();
  });

  describe('should fire events', () => {
    it('should fire zoomed and unzoomed as the scale crosses 1', () => {
      const element = createAttachedElement();
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
      expect(zoomedFunc).toHaveBeenCalled();
      expect(unzoomedFunc).not.toHaveBeenCalled();

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
      expect(unzoomedFunc).toHaveBeenCalled();
    });

    it('should not fire again when the zoom state is unchanged', () => {
      const element = createAttachedElement();
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
      expect(unzoomedFunc).not.toHaveBeenCalled();
      expect(zoomedFunc).not.toHaveBeenCalled();

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
      expect(zoomedFunc).toHaveBeenCalledTimes(1);
      expect(unzoomedFunc).not.toHaveBeenCalled();

      // Another call when already zoomed will be ignored.
      element.dispatchEvent(ev_2);
      expect(zoomedFunc).toHaveBeenCalledTimes(1);
    });

    describe('on default/non-default', () => {
      it('should treat being unzoomed as default when none is configured', () => {
        const element = createAttachedElement();
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

      it('should treat the configured zoom and pan as default', () => {
        const element = createAttachedElement();
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

      it('should treat being unzoomed as default when the configured default is empty', () => {
        const element = createAttachedElement();
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
    it('should seed the initial pan and zoom at activation', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = new ZoomController(element);
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      // Controller was not activated, config setting will not update pan/zoom.
      expect(panzoom.zoom).not.toHaveBeenCalled();
      expect(panzoom.pan).not.toHaveBeenCalled();

      controller.activate();
      expect(Panzoom).toHaveBeenCalledWith(
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

    it('should apply the default settings', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      triggerResizeObserver();

      expect(panzoom.zoom).toHaveBeenCalledWith(2, { animate: false });
      expect(panzoom.pan).toHaveBeenCalledWith(115.62, 63.6525, {
        animate: true,
        duration: 100,
      });
    });

    it('should let settings take precedence over default settings', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);

      // This call will do nothing since this is what zoom/pan already are.
      controller.setDefaultSettings({ zoom: 1, pan: { x: 0, y: 0 } });

      expect(panzoom.zoom).not.toHaveBeenCalled();
      expect(panzoom.pan).not.toHaveBeenCalled();

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

    it('should not reapply settings that match the current zoom and pan', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
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

      expect(panzoom.zoom).toHaveBeenCalledTimes(1);
      expect(panzoom.pan).toHaveBeenCalledTimes(1);
      expect(panzoom.zoom).toHaveBeenNthCalledWith(1, 2, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(1, 0, 0, {
        animate: true,
        duration: 100,
      });

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 0, y: 0 });
      controller.setSettings({ zoom: 2 });

      expect(panzoom.zoom).toHaveBeenCalledTimes(1);
      expect(panzoom.pan).toHaveBeenCalledTimes(1);
    });

    it('should fall back to the default settings when settings are empty', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });
      mockClear(panzoom);

      controller.setSettings({});

      // Should fall back to default.
      expect(panzoom.zoom).toHaveBeenCalledWith(2, { animate: false });
      expect(panzoom.pan).toHaveBeenCalledWith(115.62, 63.6525, {
        animate: true,
        duration: 100,
      });
    });

    it('should re-derive the configured pan on resize', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
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

      setElementToDefaultCardSize(element, 2);
      triggerResizeObserver();

      expect(panzoom.zoom).toHaveBeenNthCalledWith(2, 2, { animate: false });
      expect(panzoom.pan).toHaveBeenNthCalledWith(2, 231.24, 127.305, {
        animate: true,
        duration: 100,
      });
    });

    it('should not undo the user zoom when resized', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setSettings({ zoom: 2, pan: { x: 3, y: 4 } });
      expect(panzoom.zoom).toHaveBeenCalledTimes(1);

      // The user pinches to their own scale. Panzoom reports the gesture that
      // caused it in originalEvent.
      vi.mocked(panzoom.getScale).mockReturnValue(4);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 10, y: 20 });
      element.dispatchEvent(
        new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 10,
            y: 20,
            scale: 4,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        }),
      );

      // A resize must leave that zoom alone rather than springing back to the
      // configured scale, and must carry the user's pan over to the new size.
      setElementToDefaultCardSize(element, 2);
      triggerResizeObserver();
      expect(panzoom.zoom).toHaveBeenCalledTimes(1);
      expect(panzoom.pan).toHaveBeenNthCalledWith(2, 20, 40, { animate: false });

      // A newly supplied configuration takes precedence again.
      controller.setSettings({ zoom: 3, pan: { x: 5, y: 6 } });
      expect(panzoom.zoom).toHaveBeenNthCalledWith(2, 3, { animate: false });
    });

    it('should not re-pan when scale is 1', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      createAndRegisterZoom(element);

      element.dispatchEvent(
        new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 0,
            y: 0,
            scale: 1,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        }),
      );

      setElementToDefaultCardSize(element, 2);
      triggerResizeObserver();

      expect(panzoom.pan).not.toHaveBeenCalled();
    });

    it('should not re-pan when the element has no size', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      createAndRegisterZoom(element);

      vi.mocked(panzoom.getScale).mockReturnValue(4);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 10, y: 20 });
      element.dispatchEvent(
        new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 10,
            y: 20,
            scale: 4,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        }),
      );

      setElementToDefaultCardSize(element, 0);
      triggerResizeObserver();

      expect(panzoom.pan).not.toHaveBeenCalled();
    });

    it('should still apply config after a programmatic zoom change', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setSettings({ zoom: 2, pan: { x: 3, y: 4 } });
      expect(panzoom.zoom).toHaveBeenCalledTimes(1);

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 3, y: 4 });

      // Panzoom reports its own programmatic changes with no originalEvent.
      // Those must not count as a user adjustment, or the card would stop
      // maintaining the configured view after its very first update.
      element.dispatchEvent(
        new CustomEvent('panzoomchange', {
          detail: {
            x: 3,
            y: 4,
            scale: 2,
            isSVG: false,
          },
        }),
      );

      setElementToDefaultCardSize(element, 2);
      triggerResizeObserver();

      expect(panzoom.zoom).toHaveBeenCalledTimes(2);
    });

    it('should apply new default settings after a user zoom', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);

      vi.mocked(panzoom.getScale).mockReturnValue(4);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 10, y: 20 });
      element.dispatchEvent(
        new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 10,
            y: 20,
            scale: 4,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        }),
      );

      // Change configured settings.
      controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });
      expect(panzoom.zoom).toHaveBeenNthCalledWith(1, 2, { animate: false });

      setElementToDefaultCardSize(element, 2);
      triggerResizeObserver();

      // Resize will respect configured (not user) values.
      expect(panzoom.zoom).toHaveBeenNthCalledWith(2, 2, { animate: false });
    });

    it('should apply the configuration again after reactivation', () => {
      const firstPanzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(firstPanzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      vi.mocked(firstPanzoom.getScale).mockReturnValue(4);
      vi.mocked(firstPanzoom.getPan).mockReturnValue({ x: 10, y: 20 });
      element.dispatchEvent(
        new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x: 10,
            y: 20,
            scale: 4,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        }),
      );

      controller.deactivate();

      // Deactivation discards the user adjustment, so the resize follows config.
      const secondPanzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(secondPanzoom);
      controller.activate();

      setElementToDefaultCardSize(element, 2);
      triggerResizeObserver();
      expect(secondPanzoom.zoom).toHaveBeenCalledWith(2, { animate: false });
    });

    it('should ignore a resize before activation', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      new ZoomController(element);

      triggerResizeObserver();

      expect(panzoom.zoom).not.toHaveBeenCalled();
      expect(panzoom.pan).not.toHaveBeenCalled();
    });

    it('should ignore a resize while the element has no size', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element, 0);
      createAndRegisterZoom(element);

      triggerResizeObserver();

      expect(panzoom.zoom).not.toHaveBeenCalled();
      expect(panzoom.pan).not.toHaveBeenCalled();
    });

    it('should defer the configured settings until the element has a size', () => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element, 0);

      const controller = new ZoomController(element);
      controller.setSettings({ zoom: 2, pan: { x: 3, y: 4 } });
      controller.activate();

      // ResizeObserver delivers a callback on observe(), which on a slow device
      // arrives before layout has given the element a size.
      triggerResizeObserver();

      expect(panzoom.zoom).not.toHaveBeenCalled();
      expect(panzoom.pan).not.toHaveBeenCalled();

      setElementToDefaultCardSize(element);
      triggerResizeObserver();

      expect(panzoom.zoom).toHaveBeenCalledWith(2, { animate: false });
      expect(panzoom.pan).toHaveBeenCalledWith(115.62, 63.6525, {
        animate: true,
        contain: undefined,
        duration: 100,
      });
    });
  });

  describe('with a configured pan pending on the next frame', () => {
    // Applies the configuration and holds the pan on the frame it is scheduled
    // for, so the test can replace the panzoom instance before the pan runs.
    const startConfiguredPan = (): {
      controller: ZoomController;
      panzoom: PanzoomObject;
      runPendingFrames: () => void;
    } => {
      const pendingFrames: FrameRequestCallback[] = [];
      const requestAnimationFrame = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => {
          pendingFrames.push(callback);
          return 1;
        });
      onTestFinished(() => requestAnimationFrame.mockRestore());

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

      const element = createAttachedElement();
      setElementToDefaultCardSize(element);

      const controller = createAndRegisterZoom(element);
      controller.setSettings({ zoom: 2, pan: { x: 3, y: 4 } });

      expect(panzoom.zoom).toHaveBeenCalledWith(2, { animate: false });
      expect(panzoom.pan).not.toHaveBeenCalled();

      return {
        controller,
        panzoom,
        runPendingFrames: () => pendingFrames.forEach((frame) => frame(0)),
      };
    };

    it('should not pan after deactivation', () => {
      const { controller, panzoom, runPendingFrames } = startConfiguredPan();

      controller.deactivate();

      runPendingFrames();

      expect(panzoom.pan).not.toHaveBeenCalled();
    });

    it('should not pan the replacement instance', () => {
      const { controller, panzoom, runPendingFrames } = startConfiguredPan();

      controller.deactivate();

      const reactivatedPanzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(reactivatedPanzoom);
      controller.activate();

      runPendingFrames();

      expect(panzoom.pan).not.toHaveBeenCalled();
      expect(reactivatedPanzoom.pan).not.toHaveBeenCalled();

      // Nothing is lost by dropping the pan: the new instance is constructed
      // with the configured settings.
      expect(Panzoom).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          startScale: 2,
          startX: 115.62,
          startY: 63.6525,
        }),
      );
    });
  });

  it('should report activation state', () => {
    const element = createAttachedElement();
    vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());

    const controller = new ZoomController(element);
    expect(controller.isActivated()).toBe(false);

    controller.activate();
    expect(controller.isActivated()).toBe(true);

    controller.deactivate();
    expect(controller.isActivated()).toBe(false);
  });

  it('should not activate when the element is detached', () => {
    const element = document.createElement('div');
    vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());

    const controller = new ZoomController(element);
    controller.activate();

    expect(Panzoom).not.toHaveBeenCalled();
    expect(controller.isActivated()).toBe(false);

    // Activation succeeds once the element is attached.
    document.body.appendChild(element);
    controller.activate();

    expect(Panzoom).toHaveBeenCalled();
    expect(controller.isActivated()).toBe(true);
  });

  it('should not zoom or pan when zoom is disabled', () => {
    const element = createAttachedElement();

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    const controller = createAndRegisterZoom(element);

    // Simulate being zoomed in.
    panzoom.getScale = vi.fn().mockReturnValue(1.2);

    controller.setZoom(false);

    const ev = new PointerEvent('pointerdown');
    element.dispatchEvent(ev);

    expect(panzoom.handleDown).not.toHaveBeenCalled();
  });

  it('should set touch action on zoom/unzoom', () => {
    const element = createAttachedElement();
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
