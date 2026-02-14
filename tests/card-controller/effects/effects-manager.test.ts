import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectsManager } from '../../../src/card-controller/effects/effects-manager';
import { EffectComponent } from '../../../src/card-controller/effects/types';
import { EffectName } from '../../../src/types';
import { flushPromises } from '../../test-utils';

vi.mock('../../../src/components/effects/fireworks', () => ({
  AdvancedCameraCardEffectFireworks: vi.fn(() => createMockEffectComponent()),
}));

vi.mock('../../../src/components/effects/check', () => ({
  AdvancedCameraCardEffectCheck: vi.fn(() => createMockEffectComponent()),
}));

vi.mock('../../../src/components/effects/ghost', () => ({
  AdvancedCameraCardEffectGhost: vi.fn(() => createMockEffectComponent()),
}));

vi.mock('../../../src/components/effects/hearts', () => ({
  AdvancedCameraCardEffectHearts: vi.fn(() => createMockEffectComponent()),
}));

vi.mock('../../../src/components/effects/shamrocks', () => ({
  AdvancedCameraCardEffectShamrocks: vi.fn(() => createMockEffectComponent()),
}));

vi.mock('../../../src/components/effects/snow', () => ({
  AdvancedCameraCardEffectSnow: vi.fn(() => createMockEffectComponent()),
}));

const createMockEffectComponent = (): EffectComponent => {
  const element = document.createElement('div') as unknown as EffectComponent;
  element.fadeIn = true;
  element.startFadeOut = vi.fn().mockResolvedValue(undefined);
  return element;
};

// @vitest-environment jsdom
describe('EffectsManager', () => {
  let container: HTMLElement;
  let manager: EffectsManager;

  beforeEach(() => {
    container = document.createElement('div');
    manager = new EffectsManager();
    manager.setContainer(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('startEffect', () => {
    it('should load and start snow effect', async () => {
      expect(container.children.length).toBe(0);

      await manager.startEffect('snow');

      expect(container.children.length).toBe(1);
    });

    it('should load and start hearts effect', async () => {
      expect(container.children.length).toBe(0);

      await manager.startEffect('hearts');

      expect(container.children.length).toBe(1);
    });

    it('should load and start shamrocks effect', async () => {
      expect(container.children.length).toBe(0);

      await manager.startEffect('shamrocks');

      expect(container.children.length).toBe(1);
    });

    it('should load and start fireworks effect', async () => {
      expect(container.children.length).toBe(0);

      await manager.startEffect('fireworks');

      expect(container.children.length).toBe(1);
    });

    it('should load and start ghost effect', async () => {
      expect(container.children.length).toBe(0);

      await manager.startEffect('ghost');

      expect(container.children.length).toBe(1);
    });

    it('should load and start check effect', async () => {
      expect(container.children.length).toBe(0);

      await manager.startEffect('check');

      expect(container.children.length).toBe(1);
    });

    it('should stop effect automatically after duration', async () => {
      const effectPromise = manager.startEffect('snow', { duration: 1 });

      // Wait for the effect to be added to the DOM.
      await flushPromises();

      expect(container.children.length).toBe(1);

      vi.advanceTimersByTime(1000);
      await effectPromise;

      expect(container.children.length).toBe(0);
    });

    it('should clean up timer when stopped manually', async () => {
      // Don't await startEffect as it waits for the duration
      manager.startEffect('snow', { duration: 10 });

      // Wait for the effect to be added to the DOM.
      await flushPromises();

      await manager.stopEffect('snow');

      expect(container.children.length).toBe(0);
    });

    it('should set fadeIn to true by default', async () => {
      await manager.startEffect('snow');

      const effectElement = container.children[0] as EffectComponent;
      expect(effectElement.fadeIn).toBe(true);
    });

    it('should set fadeIn from options', async () => {
      await manager.startEffect('snow', { fadeIn: false });

      const effectElement = container.children[0] as EffectComponent;
      expect(effectElement.fadeIn).toBe(false);
    });

    it('should queue effects until a container is available', async () => {
      manager.removeContainer();

      await manager.startEffect('snow');

      expect(container.children.length).toBe(0);

      manager.setContainer(container);
      await flushPromises();

      expect(container.children.length).toBe(1);
    });

    it('should not start effect if already active', async () => {
      await manager.startEffect('snow');
      await manager.startEffect('snow');

      // Should only have one child since the second call is ignored.
      expect(container.children.length).toBe(1);
    });

    it('should allow starting different effects simultaneously', async () => {
      await manager.startEffect('snow');
      await manager.startEffect('hearts');

      expect(container.children.length).toBe(2);
    });

    it('should return early if effect module cannot be loaded', async () => {
      // Use an effect name that doesn't exist in the registry
      await manager.startEffect('unknown' as EffectName);

      expect(container.children.length).toBe(0);
    });
  });

  describe('stopEffect', () => {
    it('should stop an active effect', async () => {
      await manager.startEffect('snow');
      const effectElement = container.children[0] as EffectComponent;

      await manager.stopEffect('snow');

      expect(effectElement.startFadeOut).toHaveBeenCalled();
      expect(container.children.length).toBe(0);
    });

    it('should do nothing if effect is not active', async () => {
      expect(container.children.length).toBe(0);

      await manager.stopEffect('snow');

      expect(container.children.length).toBe(0);
    });

    it('should allow starting effect again after stopping', async () => {
      await manager.startEffect('snow');
      await manager.stopEffect('snow');
      await manager.startEffect('snow');

      expect(container.children.length).toBe(1);
    });

    it('should cancel effect when stopped during loading', async () => {
      // Start the effect but don't await it - simulates the loading phase.
      const startPromise = manager.startEffect('snow');

      // Stop the effect immediately while it's still loading.
      await manager.stopEffect('snow');

      // Wait for start to complete.
      await startPromise;

      // The effect should not appear since it was stopped during loading.
      expect(container.children.length).toBe(0);
    });

    it('should cancel queued effects', async () => {
      manager.removeContainer();
      await manager.startEffect('snow');
      await manager.stopEffect('snow');

      manager.setContainer(container);
      await flushPromises();

      expect(container.children.length).toBe(0);
    });

    it('should clear active effects and timers when container is removed', async () => {
      manager.startEffect('snow', { duration: 10 });
      await flushPromises();

      expect(container.children.length).toBe(1);

      manager.removeContainer();

      expect(container.children.length).toBe(0);
    });
  });

  describe('toggleEffect', () => {
    it('should start effect when not active', async () => {
      await manager.toggleEffect('snow');

      expect(container.children.length).toBe(1);
    });

    it('should stop effect when active', async () => {
      await manager.startEffect('snow');
      const effectElement = container.children[0] as EffectComponent;

      await manager.toggleEffect('snow');

      expect(effectElement.startFadeOut).toHaveBeenCalled();
    });

    it('should pass options when starting effect', async () => {
      await manager.toggleEffect('snow', { fadeIn: false });

      const effectElement = container.children[0] as EffectComponent;
      expect(effectElement.fadeIn).toBe(false);
    });

    it('should cancel effect when toggled during loading', async () => {
      // Start the effect but don't await it - simulates the loading phase.
      const startPromise = manager.startEffect('snow');

      // Toggle the effect immediately while it's still loading.
      await manager.toggleEffect('snow');

      // Wait for start to complete.
      await startPromise;

      // The effect should not appear since it was toggled (stopped) during loading.
      expect(container.children.length).toBe(0);
    });
  });
});
