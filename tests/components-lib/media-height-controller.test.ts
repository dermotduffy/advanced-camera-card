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
import { setLayoutSize } from './test-utils';

const cap = (px: number): string => `var(${FULLSCREEN_MAX_HEIGHT_PROPERTY}, ${px}px)`;

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
      setLayoutSize(child, { height: 600 });
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
      setLayoutSize(child, { height: 600 });
      // A scaled-down ancestor shrinks the bounding rect but not the layout
      // height.
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

      setLayoutSize(child, { height: 800 });

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

      setLayoutSize(child, { height: 800 });

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
      setLayoutSize(child_0, { height: 100 });
      root.appendChild(child_0);

      controller.setRoot(root);

      const child_1 = document.createElement('div');
      setLayoutSize(child_1, { height: 200 });
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
      setLayoutSize(child, { height: 700 });
      root.appendChild(child);

      controller.setRoot(root);
      controller.setSelected(0);

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(700));

      setLayoutSize(child, { height: 900 });

      controller.recalculate();

      vi.advanceTimersByTime(SET_HEIGHT_DEBOUNCE_SECONDS * 1000);

      expect(host.style.maxHeight).toBe(cap(900));
    });

    it('should not set height when the selected child has no height', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      setLayoutSize(child, { height: 0 });
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
      setLayoutSize(child_0, { height: 750 });
      const child_1 = document.createElement('div');
      setLayoutSize(child_1, { height: 562 });
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
