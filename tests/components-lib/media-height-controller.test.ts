import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  FULLSCREEN_MAX_HEIGHT_PROPERTY,
  MediaHeightController,
  SET_HEIGHT_DEBOUNCE_SECONDS,
} from '../../src/components-lib/media-height-controller';
import {
  callMutationHandler,
  callResizeHandler,
  MutationObserverMock,
  ResizeObserverMock,
} from '../test-utils';

const cap = (px: number): string => `var(${FULLSCREEN_MAX_HEIGHT_PROPERTY}, ${px}px)`;

// jsdom performs no layout, so the layout height is supplied explicitly.
const setLayoutHeight = (element: HTMLElement, height: number): void => {
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: height,
  });
};

// @vitest-environment jsdom
describe('MediaHeightController', () => {
  beforeAll(() => {
    vi.stubGlobal('MutationObserver', MutationObserverMock);
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('should set height', () => {
    it('should set height on selection', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      setLayoutHeight(child, 600);
      root.appendChild(child);

      controller.setRoot(root);

      // Calling a second time has no effect.
      controller.setRoot(root);

      controller.setSelected(0);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(600));
    });

    it('should ignore ancestor transforms when measuring the height', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      setLayoutHeight(child, 600);
      // E.g. the card is inside an SVG <foreignObject> that is scaled down: the
      // bounding rect reports the scaled height, but max-height is applied in
      // untransformed pixels.
      child.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 300,
      });
      root.appendChild(child);

      controller.setRoot(root);
      controller.setSelected(0);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(600));
    });

    it('should not set height without children', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');

      controller.setRoot(root);

      controller.setSelected(10);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe('');
    });

    it('should respond to resize observer of selected child', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);

      controller.setRoot(root);
      controller.setSelected(0);

      setLayoutHeight(child, 800);

      callResizeHandler([
        {
          target: child,
          height: 800,
          width: 400,
        },
      ]);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(800));
    });

    it('should not respond to resize observer without a selected child', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);

      controller.setRoot(root);

      setLayoutHeight(child, 800);

      callResizeHandler([
        {
          target: child,
          height: 800,
          width: 400,
        },
      ]);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe('');
    });

    it('should respond to new children being added', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child_0 = document.createElement('div');
      setLayoutHeight(child_0, 100);
      root.appendChild(child_0);

      controller.setRoot(root);

      const child_1 = document.createElement('div');
      setLayoutHeight(child_1, 200);
      root.appendChild(child_1);

      callMutationHandler();

      controller.setSelected(1);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(200));
    });

    it('should set height on recalculate', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      setLayoutHeight(child, 700);
      root.appendChild(child);

      controller.setRoot(root);
      controller.setSelected(0);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(700));

      setLayoutHeight(child, 900);

      controller.recalculate();

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(900));
    });

    it('should not set height when the selected child has no height', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      setLayoutHeight(child, 0);
      root.appendChild(child);

      controller.setRoot(root);
      controller.setSelected(0);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe('');
    });

    it('should allow height to shrink when selected child is shorter', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child_0 = document.createElement('div');
      setLayoutHeight(child_0, 750);
      const child_1 = document.createElement('div');
      setLayoutHeight(child_1, 562);
      root.appendChild(child_0);
      root.appendChild(child_1);

      controller.setRoot(root);
      controller.setSelected(0);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(750));

      controller.setSelected(1);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(562));
    });
  });

  it('should destroy', () => {
    const host = document.createElement('div');
    const controller = new MediaHeightController(host, 'div');

    controller.destroy();

    // No observable effect.
  });
});
