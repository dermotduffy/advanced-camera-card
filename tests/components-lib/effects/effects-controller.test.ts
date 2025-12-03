import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectsController } from '../../../src/components-lib/effects/effects-controller';
import { EffectComponent } from '../../../src/components-lib/effects/types';
import { EffectName } from '../../../src/types';

vi.mock('../../../src/components/effects/fireworks', () => ({
  AdvancedCameraCardEffectFireworks: vi.fn(() => createMockEffectComponent()),
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
describe('EffectsController', () => {
  let container: HTMLElement;
  let controller: EffectsController;

  beforeEach(() => {
    container = document.createElement('div');
    controller = new EffectsController();
    controller.setContainer(container);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startEffect', () => {
    it('should load and start snow effect', async () => {
      expect(container.children.length).toBe(0);

      await controller.startEffect('snow');

      expect(container.children.length).toBe(1);
    });

    it('should load and start hearts effect', async () => {
      expect(container.children.length).toBe(0);

      await controller.startEffect('hearts');

      expect(container.children.length).toBe(1);
    });

    it('should load and start shamrocks effect', async () => {
      expect(container.children.length).toBe(0);

      await controller.startEffect('shamrocks');

      expect(container.children.length).toBe(1);
    });

    it('should load and start fireworks effect', async () => {
      expect(container.children.length).toBe(0);

      await controller.startEffect('fireworks');

      expect(container.children.length).toBe(1);
    });

    it('should load and start ghost effect', async () => {
      expect(container.children.length).toBe(0);

      await controller.startEffect('ghost');

      expect(container.children.length).toBe(1);
    });

    it('should set fadeIn to true by default', async () => {
      await controller.startEffect('snow');

      const effectElement = container.children[0] as EffectComponent;
      expect(effectElement.fadeIn).toBe(true);
    });

    it('should set fadeIn from options', async () => {
      await controller.startEffect('snow', { fadeIn: false });

      const effectElement = container.children[0] as EffectComponent;
      expect(effectElement.fadeIn).toBe(false);
    });

    it('should not start effect if container is null', async () => {
      controller.setContainer(null);

      await controller.startEffect('snow');

      expect(container.children.length).toBe(0);
    });

    it('should not start effect if already active', async () => {
      await controller.startEffect('snow');
      await controller.startEffect('snow');

      // Should only have one child since the second call is ignored.
      expect(container.children.length).toBe(1);
    });

    it('should allow starting different effects simultaneously', async () => {
      await controller.startEffect('snow');
      await controller.startEffect('hearts');

      expect(container.children.length).toBe(2);
    });

    it('should return early if effect module cannot be loaded', async () => {
      // Use an effect name that doesn't exist in the registry
      await controller.startEffect('unknown' as EffectName);

      expect(container.children.length).toBe(0);
    });
  });

  describe('stopEffect', () => {
    it('should stop an active effect', async () => {
      await controller.startEffect('snow');
      const effectElement = container.children[0] as EffectComponent;

      await controller.stopEffect('snow');

      expect(effectElement.startFadeOut).toHaveBeenCalled();
      expect(container.children.length).toBe(0);
    });

    it('should do nothing if effect is not active', async () => {
      expect(container.children.length).toBe(0);

      await controller.stopEffect('snow');

      expect(container.children.length).toBe(0);
    });

    it('should allow starting effect again after stopping', async () => {
      await controller.startEffect('snow');
      await controller.stopEffect('snow');
      await controller.startEffect('snow');

      expect(container.children.length).toBe(1);
    });

    it('should cancel effect when stopped during loading', async () => {
      // Start the effect but don't await it - simulates the loading phase.
      const startPromise = controller.startEffect('snow');

      // Stop the effect immediately while it's still loading.
      await controller.stopEffect('snow');

      // Wait for start to complete.
      await startPromise;

      // The effect should not appear since it was stopped during loading.
      expect(container.children.length).toBe(0);
    });
  });

  describe('toggleEffect', () => {
    it('should start effect when not active', async () => {
      await controller.toggleEffect('snow');

      expect(container.children.length).toBe(1);
    });

    it('should stop effect when active', async () => {
      await controller.startEffect('snow');
      const effectElement = container.children[0] as EffectComponent;

      await controller.toggleEffect('snow');

      expect(effectElement.startFadeOut).toHaveBeenCalled();
    });

    it('should pass options when starting effect', async () => {
      await controller.toggleEffect('snow', { fadeIn: false });

      const effectElement = container.children[0] as EffectComponent;
      expect(effectElement.fadeIn).toBe(false);
    });

    it('should cancel effect when toggled during loading', async () => {
      // Start the effect but don't await it - simulates the loading phase.
      const startPromise = controller.startEffect('snow');

      // Toggle the effect immediately while it's still loading.
      await controller.toggleEffect('snow');

      // Wait for start to complete.
      await startPromise;

      // The effect should not appear since it was toggled (stopped) during loading.
      expect(container.children.length).toBe(0);
    });
  });
});
