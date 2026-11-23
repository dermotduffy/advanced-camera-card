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

import type { PartialZoomSettings } from '../../../src/components-lib/zoom/types';
import { ZoomController } from '../../../src/components-lib/zoom/zoom-controller';
import type { CameraDimensionsConfig } from '../../../src/config/schema/cameras';
import {
  DOUBLE_TAP_PIXELS,
  DOUBLE_TAP_SECONDS,
  DRAG_THRESHOLD_PIXELS,
  HOLD_SECONDS,
} from '../../../src/const';
import {
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
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

// jsdom has no PointerEvent: https://github.com/jsdom/jsdom/issues/2527
class PointerEventPolyfill extends MouseEvent {
  public readonly isPrimary: boolean;

  constructor(type: string, init?: PointerEventInit) {
    super(type, init);
    this.isPrimary = init?.isPrimary ?? true;
  }
}
vi.stubGlobal('PointerEvent', PointerEventPolyfill);

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

      it.each([
        ['an empty default', {}],
        ['a default with only a pan', { pan: { x: 20, y: 70 } }],
      ])(
        'should not treat a zoom as default with %s',
        (_name: string, defaultSettings: PartialZoomSettings) => {
          const element = createAttachedElement();
          setElementToDefaultCardSize(element);

          const changeFunc = vi.fn();
          element.addEventListener('advanced-camera-card:zoom:change', changeFunc);

          vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
          const controller = createAndRegisterZoom(element);
          controller.setDefaultSettings(defaultSettings);

          element.dispatchEvent(
            new CustomEvent<PanzoomEventDetail>('panzoomchange', {
              detail: {
                x: 51,
                y: 51,
                scale: 2,
                isSVG: false,
                originalEvent: new PointerEvent('pointermove'),
              },
            }),
          );

          expect(changeFunc).toHaveBeenLastCalledWith(
            expect.objectContaining({
              detail: expect.objectContaining({ isDefault: false }),
            }),
          );
        },
      );

      it('should treat a zoomed default without a pan as centered', () => {
        const element = createAttachedElement();
        setElementToDefaultCardSize(element);

        const changeFunc = vi.fn();
        element.addEventListener('advanced-camera-card:zoom:change', changeFunc);

        vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
        const controller = createAndRegisterZoom(element);
        controller.setDefaultSettings({ zoom: 2 });

        // Panzoom's pan for the center is 0/0 at any scale.
        element.dispatchEvent(
          new CustomEvent<PanzoomEventDetail>('panzoomchange', {
            detail: {
              x: 0,
              y: 0,
              scale: 2,
              isSVG: false,
              originalEvent: new PointerEvent('pointermove'),
            },
          }),
        );

        expect(changeFunc).toHaveBeenLastCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({ isDefault: true }),
          }),
        );
      });

      it.each([
        ['scale 2 is default', 2, true],
        ['scale 3 is not default', 3, false],
      ])(
        'should compare only the scale with a default zoom of 2 before there is a size: %s',
        (_name: string, scale: number, isDefault: boolean) => {
          const element = createAttachedElement();

          const changeFunc = vi.fn();
          element.addEventListener('advanced-camera-card:zoom:change', changeFunc);

          vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());
          const controller = createAndRegisterZoom(element);
          controller.setDefaultSettings({ zoom: 2, pan: { x: 3, y: 4 } });

          element.dispatchEvent(
            new CustomEvent<PanzoomEventDetail>('panzoomchange', {
              detail: {
                x: 0,
                y: 0,
                scale,
                isSVG: false,
                originalEvent: new PointerEvent('pointermove'),
              },
            }),
          );

          expect(changeFunc).toHaveBeenLastCalledWith(
            expect.objectContaining({
              detail: expect.objectContaining({ isDefault }),
            }),
          );
        },
      );

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
          cursor: undefined,
          maxScale: 10,
          minScale: 1,
          noBind: true,
          touchAction: 'pan-x pan-y',
          startScale: 2,
          startX: 115.62,
          startY: 63.6525,
        }),
      );
      expect(vi.mocked(Panzoom).mock.calls[0][1]).not.toHaveProperty('contain');
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
    expect(element.style.touchAction).toBe('pan-x pan-y');
  });

  describe('double tap', () => {
    const HOLD_MS = HOLD_SECONDS * 1000;
    const DOUBLE_TAP_MS = DOUBLE_TAP_SECONDS * 1000;

    // A zoomed-in controller whose element has a size, a listener for its
    // zoom:home events, and fake timers that set each new event's `timeStamp`.
    const createZoomed = (options?: {
      touch?: boolean;
    }): { element: HTMLElement; panzoom: PanzoomObject; home: Mock } => {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });

      mediaSpy.mockReturnValue(<MediaQueryList>{ matches: !options?.touch });
      const element = createAttachedElement();
      setElementToDefaultCardSize(element);
      const panzoom = createMockPanZoom();
      panzoom.getScale = vi.fn().mockReturnValue(2);
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);
      createAndRegisterZoom(element);
      const home = vi.fn();
      element.addEventListener('advanced-camera-card:zoom:home', home);
      return { element, panzoom, home };
    };

    const pointerTap = (
      element: HTMLElement,
      options?: { x?: number; moveTo?: number; holdMs?: number },
    ): void => {
      const x = options?.x ?? 100;
      element.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: x, clientY: 100 }),
      );
      vi.advanceTimersByTime(options?.holdMs ?? 50);
      element.dispatchEvent(
        new PointerEvent('pointerup', { clientX: options?.moveTo ?? x, clientY: 100 }),
      );
    };

    const touchTap = (element: HTMLElement): void => {
      const touch = createTouch({ target: element, clientX: 100, clientY: 100 });
      element.dispatchEvent(createTouchEvent('touchstart', { touches: [touch] }));
      vi.advanceTimersByTime(50);
      element.dispatchEvent(createTouchEvent('touchend', { changedTouches: [touch] }));
    };

    it('should report a pointer double tap as zoom:home without zooming itself', () => {
      const { element, panzoom, home } = createZoomed();

      pointerTap(element);
      expect(home).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      pointerTap(element, { x: 100 + DOUBLE_TAP_PIXELS - 5 });

      expect(home).toHaveBeenCalledTimes(1);
      expect(panzoom.zoom).not.toHaveBeenCalled();
    });

    it('should report a touch double tap as zoom:home', () => {
      const { element, home } = createZoomed({ touch: true });

      touchTap(element);
      vi.advanceTimersByTime(50);
      touchTap(element);

      expect(home).toHaveBeenCalledTimes(1);
    });

    it('should start a new double tap with a second tap that ends too late', () => {
      const { element, home } = createZoomed();

      pointerTap(element);
      vi.advanceTimersByTime(DOUBLE_TAP_MS);
      pointerTap(element);

      expect(home).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      pointerTap(element);

      expect(home).toHaveBeenCalledTimes(1);
    });

    it('should not report a second tap that starts in time but ends too late', () => {
      const { element, home } = createZoomed();

      pointerTap(element);
      vi.advanceTimersByTime(50);
      pointerTap(element, { holdMs: DOUBLE_TAP_MS });

      expect(home).not.toHaveBeenCalled();
    });

    it('should not report a second tap too far from the first', () => {
      const { element, home } = createZoomed();

      pointerTap(element);
      vi.advanceTimersByTime(50);
      pointerTap(element, { x: 100 + DOUBLE_TAP_PIXELS + 1 });

      expect(home).not.toHaveBeenCalled();
    });

    it('should not count a pan as a tap', () => {
      const { element, home } = createZoomed();

      pointerTap(element, { moveTo: 100 + DRAG_THRESHOLD_PIXELS + 1 });
      vi.advanceTimersByTime(50);
      pointerTap(element);

      expect(home).not.toHaveBeenCalled();
    });

    it('should not count a hold as a tap', () => {
      const { element, home } = createZoomed();

      pointerTap(element, { holdMs: HOLD_MS });
      vi.advanceTimersByTime(50);
      pointerTap(element);

      expect(home).not.toHaveBeenCalled();
    });

    it('should not count a touch pinch as a tap', () => {
      const { element, home } = createZoomed({ touch: true });

      touchTap(element);
      vi.advanceTimersByTime(50);
      const one = createTouch({ target: element, clientX: 100, clientY: 100 });
      const two = createTouch({ target: element, clientX: 105, clientY: 100 });
      element.dispatchEvent(createTouchEvent('touchstart', { touches: [one, two] }));
      element.dispatchEvent(
        createTouchEvent('touchend', { changedTouches: [one, two] }),
      );

      expect(home).not.toHaveBeenCalled();
    });

    it('should not count a further finger of a pointer pinch as a tap', () => {
      const { element, home } = createZoomed();

      pointerTap(element);
      vi.advanceTimersByTime(20);
      element.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
      );
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 105,
          clientY: 100,
          isPrimary: false,
        }),
      );
      vi.advanceTimersByTime(50);
      element.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 105, clientY: 100, isPrimary: false }),
      );

      expect(home).not.toHaveBeenCalled();
    });

    it('should report a double tap across a pointerleave after the first pointerup', () => {
      const { element, home } = createZoomed();

      pointerTap(element);
      element.dispatchEvent(new PointerEvent('pointerleave'));
      vi.advanceTimersByTime(50);
      pointerTap(element);

      expect(home).toHaveBeenCalledTimes(1);
    });

    it.each([['pointercancel'], ['pointerleave']])(
      'should not report a tap after a press that ends in a %s',
      (type: string) => {
        const { element, home } = createZoomed();

        pointerTap(element);
        vi.advanceTimersByTime(20);
        element.dispatchEvent(
          new PointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
        );
        vi.advanceTimersByTime(20);
        element.dispatchEvent(new PointerEvent(type));
        vi.advanceTimersByTime(20);
        pointerTap(element);

        expect(home).not.toHaveBeenCalled();
      },
    );

    it('should not count an up without a down as a tap', () => {
      const { element, home } = createZoomed();

      element.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 100, clientY: 100 }),
      );
      vi.advanceTimersByTime(50);
      pointerTap(element);

      expect(home).not.toHaveBeenCalled();
    });

    it('should not count an event without a position as a tap', () => {
      const { element, home } = createZoomed();

      pointerTap(element);
      vi.advanceTimersByTime(50);
      element.dispatchEvent(new Event('pointerdown'));
      element.dispatchEvent(new Event('pointerup'));

      expect(home).not.toHaveBeenCalled();
    });

    it('should leave a double tap to the card while unzoomed', () => {
      const { element, panzoom, home } = createZoomed();
      panzoom.getScale = vi.fn().mockReturnValue(1);

      pointerTap(element);
      vi.advanceTimersByTime(50);
      pointerTap(element);

      expect(panzoom.handleUp).not.toHaveBeenCalled();
      expect(home).not.toHaveBeenCalled();
    });
  });

  describe('with a picture that does not fill the element', () => {
    interface Size {
      width: number;
      height: number;
    }

    // A 16:9 picture in a portrait fullscreen is 411x231.1875 inside 411x914.
    const PORTRAIT: Size = { width: 411, height: 914 };
    const LANDSCAPE: Size = { width: 914, height: 411 };

    const setElementSize = (element: HTMLElement, size: Size): void => {
      Object.defineProperty(element, 'offsetWidth', {
        configurable: true,
        value: size.width,
      });
      Object.defineProperty(element, 'offsetHeight', {
        configurable: true,
        value: size.height,
      });
    };

    const dispatchMediaLoaded = (
      element: HTMLElement,
      size: Size,
      signal?: AbortSignal,
    ): void => {
      element.dispatchEvent(
        createMediaLoadedInfoEvent({ info: createMediaLoadedInfo(size), signal }),
      );
    };

    const createPictureZoom = (options?: {
      elementSize?: Size;
      mediaSize?: Size | null;
      dimensionsConfig?: CameraDimensionsConfig;
    }): {
      element: HTMLElement;
      panzoom: PanzoomObject;
      controller: ZoomController;
      media: AbortController;
    } => {
      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);
      const element = createAttachedElement();
      setElementSize(element, options?.elementSize ?? PORTRAIT);
      const controller = createAndRegisterZoom(element);
      if (options?.dimensionsConfig) {
        controller.setDimensionsConfig(options.dimensionsConfig);
      }

      const media = new AbortController();
      const mediaSize =
        options?.mediaSize === undefined
          ? { width: 1600, height: 900 }
          : options.mediaSize;
      if (mediaSize) {
        dispatchMediaLoaded(element, mediaSize, media.signal);
      }

      mockClear(panzoom);
      return { element, panzoom, controller, media };
    };

    const drag = (element: HTMLElement): void => {
      element.dispatchEvent(new PointerEvent('pointerdown'));
      element.dispatchEvent(new PointerEvent('pointermove'));
    };

    const gesture = (
      element: HTMLElement,
      x: number,
      y: number,
      scale: number,
    ): void => {
      element.dispatchEvent(
        new CustomEvent<PanzoomEventDetail>('panzoomchange', {
          detail: {
            x,
            y,
            scale,
            isSVG: false,
            originalEvent: new PointerEvent('pointermove'),
          },
        }),
      );
    };

    it('should pull a gesture back to the picture', () => {
      const { element, panzoom } = createPictureZoom();

      // At x2 the picture is 822 wide (102.75 of room either side) but only
      // 462 high, so it stays centered vertically.
      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 200, y: 150 });
      drag(element);

      expect(panzoom.pan).toHaveBeenCalledWith(102.75, 0, {
        animate: false,
        silent: true,
      });
    });

    it('should allow a vertical pan once the picture is taller than the element', () => {
      const { element, panzoom } = createPictureZoom();

      vi.mocked(panzoom.getScale).mockReturnValue(5);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: -300, y: -100 });
      drag(element);

      expect(panzoom.pan).toHaveBeenCalledWith(
        expect.closeTo(-164.4),
        expect.closeTo(-24.19375),
        { animate: false, silent: true },
      );
    });

    it('should leave a gesture within the picture alone', () => {
      const { element, panzoom } = createPictureZoom();

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 50, y: 0 });
      drag(element);

      expect(panzoom.pan).not.toHaveBeenCalled();
    });

    it('should pull a wheel zoom back to the picture', () => {
      const { element, panzoom } = createPictureZoom();

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 0, y: -200 });
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true }));

      expect(panzoom.zoomWithWheel).toHaveBeenCalled();
      expect(panzoom.pan).toHaveBeenCalledWith(0, 0, {
        animate: false,
        silent: true,
      });
    });

    it('should center a wheel zoom back out to scale 1', () => {
      const { element, panzoom } = createPictureZoom();

      vi.mocked(panzoom.getScale).mockReturnValue(1);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 3, y: 4 });
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, ctrlKey: true }));

      expect(panzoom.pan).toHaveBeenCalledWith(0, 0, {
        animate: false,
        silent: true,
      });
    });

    it('should limit a gesture to the element without the media size', () => {
      const { element, panzoom } = createPictureZoom({ mediaSize: null });

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 200, y: 150 });
      drag(element);

      expect(panzoom.pan).toHaveBeenCalledWith(102.75, 150, {
        animate: false,
        silent: true,
      });
    });

    it('should limit a gesture to the element for media without a size', () => {
      const { element, panzoom } = createPictureZoom({
        mediaSize: { width: 0, height: 0 },
      });

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 200, y: 150 });
      drag(element);

      expect(panzoom.pan).toHaveBeenCalledWith(102.75, 150, {
        animate: false,
        silent: true,
      });
    });

    it('should limit a gesture to the element when the layout covers it', () => {
      const { element, panzoom } = createPictureZoom({
        dimensionsConfig: { layout: { fit: 'cover' } },
      });

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 200, y: 150 });
      drag(element);

      expect(panzoom.pan).toHaveBeenCalledWith(102.75, 150, {
        animate: false,
        silent: true,
      });
    });

    it('should stop following media loads once deactivated', () => {
      const { element, controller } = createPictureZoom({ mediaSize: null });

      controller.deactivate();
      dispatchMediaLoaded(element, { width: 1600, height: 900 });

      const panzoom = createMockPanZoom();
      vi.mocked(Panzoom).mockReturnValueOnce(panzoom);
      controller.activate();

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 200, y: 150 });
      drag(element);

      expect(panzoom.pan).toHaveBeenCalledWith(102.75, 150, {
        animate: false,
        silent: true,
      });
    });

    it('should apply a configured pan within the picture', () => {
      const { panzoom, controller } = createPictureZoom();

      controller.setSettings({ zoom: 2, pan: { x: 0, y: 0 } });

      expect(panzoom.zoom).toHaveBeenCalledWith(2, { animate: false });
      expect(panzoom.pan).toHaveBeenCalledWith(102.75, 0, {
        animate: true,
        duration: 100,
      });
    });

    it('should keep the pan within the picture as a configured zoom is applied', () => {
      const { panzoom, controller } = createPictureZoom();

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 300, y: 100 });
      controller.setSettings({ zoom: 2, pan: { x: 50, y: 50 } });

      expect(panzoom.pan).toHaveBeenNthCalledWith(1, 102.75, 0, {
        animate: false,
        silent: true,
      });
      expect(panzoom.pan).toHaveBeenNthCalledWith(2, 0, 0, {
        animate: true,
        duration: 100,
      });
    });

    it('should limit the pan to a picture with bars left and right', () => {
      // A 4:3 picture is 548x411 inside 914x411.
      const { panzoom, controller } = createPictureZoom({
        elementSize: LANDSCAPE,
        mediaSize: { width: 1600, height: 1200 },
      });

      controller.setSettings({ zoom: 2, pan: { x: 0, y: 100 } });

      expect(panzoom.pan).toHaveBeenCalledWith(
        expect.closeTo(45.5),
        expect.closeTo(-102.75),
        { animate: true, duration: 100 },
      );
    });

    it('should report a pan past the limits as the limit it is kept to', () => {
      const { element, controller } = createPictureZoom();
      controller.setDefaultSettings({ zoom: 2, pan: { x: 0, y: 50 } });
      const changeHandler = vi.fn();
      element.addEventListener('advanced-camera-card:zoom:change', changeHandler);

      gesture(element, 200, 10, 2);

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            pan: { x: 0, y: 50 },
            isDefault: true,
          }),
        }),
      );
    });

    it('should keep the earlier pan on an axis without room', () => {
      const { element, panzoom } = createPictureZoom();

      // At x5 the picture is taller than the element: a pan towards the top.
      gesture(element, -100, -10, 5);

      // At x2 it fits the height: a sideways pan cannot move it vertically.
      gesture(element, 50, 0, 2);

      // Back at the card's size (where the picture fills the element), the
      // vertical pan from x5 (70.7 %) is still there, the sideways one too.
      vi.mocked(panzoom.getScale).mockReturnValue(2);
      setElementToDefaultCardSize(element);
      triggerResizeObserver();
      expect(panzoom.pan).toHaveBeenLastCalledWith(
        expect.closeTo(59.854),
        expect.closeTo(-28.597),
        { animate: false },
      );
    });

    it('should keep the earlier sideways pan with bars left and right', () => {
      // A 16:9 picture is 730.7x411 inside 914x411. At x3 it is wider than the
      // element: a pan towards the left. At x1.2 it fits the width.
      const { element, panzoom } = createPictureZoom({ elementSize: LANDSCAPE });
      gesture(element, -100, 0, 3);
      gesture(element, 0, -20, 1.2);

      vi.mocked(panzoom.getScale).mockReturnValue(1.2);
      setElementToDefaultCardSize(element);
      triggerResizeObserver();
      expect(panzoom.pan).toHaveBeenLastCalledWith(
        expect.closeTo(-19.249),
        expect.closeTo(-13.467),
        { animate: false },
      );
    });

    it('should center an axis without room and no earlier pan', () => {
      const { element, panzoom } = createPictureZoom();

      gesture(element, 50, 0, 2);

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      setElementToDefaultCardSize(element);
      triggerResizeObserver();
      expect(panzoom.pan).toHaveBeenLastCalledWith(expect.closeTo(59.854), 0, {
        animate: false,
      });
    });

    it('should re-derive the pan when the media size arrives', () => {
      const { element, panzoom, controller } = createPictureZoom({ mediaSize: null });

      // Without the picture's shape the element bounds the pan.
      controller.setSettings({ zoom: 2, pan: { x: 0, y: 0 } });
      expect(panzoom.pan).toHaveBeenLastCalledWith(102.75, 228.5, {
        animate: true,
        duration: 100,
      });
      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 102.75, y: 228.5 });

      dispatchMediaLoaded(element, { width: 1600, height: 900 });
      expect(panzoom.pan).toHaveBeenLastCalledWith(102.75, 0, {
        animate: true,
        duration: 100,
      });
      const calls = vi.mocked(panzoom.pan).mock.calls.length;

      // The same shape again changes nothing.
      dispatchMediaLoaded(element, { width: 1600, height: 900 });
      expect(panzoom.pan).toHaveBeenCalledTimes(calls);
    });

    it('should return to the element limits when the media unloads', () => {
      const { panzoom, controller, media } = createPictureZoom();

      controller.setSettings({ zoom: 2, pan: { x: 0, y: 0 } });
      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 102.75, y: 0 });

      media.abort();

      expect(panzoom.pan).toHaveBeenLastCalledWith(102.75, 228.5, {
        animate: true,
        duration: 100,
      });
    });

    it('should ignore the unload of media that a later load replaced', () => {
      const { element, panzoom, media } = createPictureZoom();

      // A 3:4 picture is 411x548, so at x2 it has 45.5 of room vertically.
      dispatchMediaLoaded(element, { width: 900, height: 1200 });
      media.abort();

      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 0, y: 150 });
      drag(element);

      expect(panzoom.pan).toHaveBeenLastCalledWith(0, 45.5, {
        animate: false,
        silent: true,
      });
    });

    it('should return to the element limits for a layout that covers it', () => {
      const { panzoom, controller } = createPictureZoom();

      controller.setSettings({ zoom: 2, pan: { x: 0, y: 0 } });
      vi.mocked(panzoom.getScale).mockReturnValue(2);
      vi.mocked(panzoom.getPan).mockReturnValue({ x: 102.75, y: 0 });

      controller.setDimensionsConfig({ layout: { fit: 'cover' } });

      expect(panzoom.pan).toHaveBeenLastCalledWith(102.75, 228.5, {
        animate: true,
        duration: 100,
      });
    });
  });
});
