import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaHeightController } from '../../src/components-lib/media-height-controller';
import {
  callMutationHandler,
  MutationObserverMock,
  ResizeObserverMock,
} from '../test-utils';
import { callResizeHandler } from '../utils/embla/test-utils';

vi.mock('lodash-es', async () => ({
  ...(await vi.importActual('lodash-es')),
  debounce: vi.fn((fn) => fn),
}));

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
  });

  describe('should set height', () => {
    it('should set height on selection', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      child.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 600,
      });
      root.appendChild(child);

      controller.setRoot(root);

      // Calling a second time has no effect.
      controller.setRoot(root);

      controller.setSelected(0);

      expect(host.style.maxHeight).toBe(`600px`);
    });

    it('should not set height without children', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');

      controller.setRoot(root);

      controller.setSelected(10);

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

      child.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 800,
      });

      callResizeHandler([
        {
          target: child,
          height: 800,
          width: 400,
        },
      ]);

      expect(host.style.maxHeight).toBe('800px');
    });

    it('should not respond to resize observer without a selected child', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child = document.createElement('div');
      root.appendChild(child);

      controller.setRoot(root);

      child.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 800,
      });

      callResizeHandler([
        {
          target: child,
          height: 800,
          width: 400,
        },
      ]);

      expect(host.style.maxHeight).toBe('');
    });

    it('should respond to new children being added', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child_0 = document.createElement('div');
      child_0.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 100,
      });
      root.appendChild(child_0);

      controller.setRoot(root);

      const child_1 = document.createElement('div');
      child_1.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 200,
      });
      root.appendChild(child_1);

      callMutationHandler();

      controller.setSelected(1);

      expect(host.style.maxHeight).toBe('200px');
    });

    it('should ignore new chil to new children being added', () => {
      const host = document.createElement('div');
      const controller = new MediaHeightController(host, 'div');

      const root = document.createElement('div');
      const child_0 = document.createElement('div');
      child_0.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 100,
      });
      root.appendChild(child_0);

      controller.setRoot(root);

      const child_1 = document.createElement('div');
      child_1.getBoundingClientRect = vi.fn().mockReturnValue({
        height: 200,
      });
      root.appendChild(child_1);

      callMutationHandler();

      controller.setSelected(1);

      expect(host.style.maxHeight).toBe('200px');
    });
  });

  it('should destroy', () => {
    const host = document.createElement('div');
    const controller = new MediaHeightController(host, 'div');

    controller.destroy();

    // No observable effect.
  });
});
