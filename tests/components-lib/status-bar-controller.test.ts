import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { StatusBarController } from '../../src/components-lib/status-bar-controller';
import {
  StatusBarConfig,
  statusBarConfigSchema,
} from '../../src/config/schema/status-bar';
import { setOrRemoveAttribute } from '../../src/utils/basic';
import { createInteractionActionEvent, createLitElement } from '../test-utils';

const createConfig = (config?: unknown): StatusBarConfig => {
  return statusBarConfigSchema.parse(config);
};

// @vitest-environment jsdom
describe('StatusBarController', () => {
  describe('should set config', () => {
    it('should set config', () => {
      const host = createLitElement();
      const controller = new StatusBarController(host);
      const config = createConfig({
        position: 'top',
        style: 'hover',
        height: 50,
      });
      controller.setConfig(config);

      expect(controller.getConfig()).toEqual(config);
      expect(
        host.style.getPropertyValue('--advanced-camera-card-status-bar-height'),
      ).toBe('50px');
      expect(host.getAttribute('data-style')).toBe('hover');
      expect(host.getAttribute('data-position')).toBe('top');
      expect(host.requestUpdate).toHaveBeenCalled();
    });

    it('should not hide when not in popup style', () => {
      const host = createLitElement();
      setOrRemoveAttribute(host, true, 'hide');

      const controller = new StatusBarController(host);

      controller.setConfig(
        createConfig({
          position: 'top',
          style: 'hover',
          height: 50,
        }),
      );

      expect(host.getAttribute('hide')).toBe(null);
    });

    it('should not show when in popup style', () => {
      const host = createLitElement();
      setOrRemoveAttribute(host, true, 'hide');

      const controller = new StatusBarController(host);

      controller.setConfig(
        createConfig({
          position: 'top',
          style: 'popup',
          height: 50,
        }),
      );

      expect(host.getAttribute('hide')).not.toBe(null);
    });
  });

  describe('should set items', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('set/get basic items', () => {
      const host = createLitElement();
      const controller = new StatusBarController(host);
      const items = [
        {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Test',
        },
      ];

      controller.setItems(items);
      expect(controller.getRenderItems()).toEqual(items);
    });

    it('should order items', () => {
      const host = createLitElement();
      const controller = new StatusBarController(host);
      const item1 = {
        type: 'custom:advanced-camera-card-status-bar-string' as const,
        string: 'Item 1',
        priority: 40,
      };
      const item2 = {
        type: 'custom:advanced-camera-card-status-bar-string' as const,
        string: 'Item 2',
        priority: 10,
      };
      const item3 = {
        type: 'custom:advanced-camera-card-status-bar-string' as const,
        string: 'Item 3',
        priority: 60,
      };
      const item4 = {
        type: 'custom:advanced-camera-card-status-bar-string' as const,
        string: 'Item 4',
        priority: undefined,
      };

      controller.setItems([item1, item2, item3, item4]);
      expect(controller.getRenderItems()).toEqual([item3, item4, item1, item2]);
    });

    it('should treat exclusive items exclusively', () => {
      const host = createLitElement();
      const controller = new StatusBarController(host);
      const item1 = {
        type: 'custom:advanced-camera-card-status-bar-string' as const,
        string: 'Item 1',
        priority: 100,
      };
      const exclusiveItem = {
        type: 'custom:advanced-camera-card-status-bar-string' as const,
        string: 'Item 2',
        priority: 1,
        exclusive: true,
      };

      controller.setItems([item1, exclusiveItem]);
      expect(controller.getRenderItems()).toEqual([exclusiveItem]);
    });

    describe('should recognize sufficient items', () => {
      it('with sufficient item', () => {
        const host = createLitElement();
        const controller = new StatusBarController(host);
        const insufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 1',
          sufficient: false,
        };
        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 2',
          sufficient: true,
        };

        controller.setItems([insufficientItem, sufficientItem]);
        expect(controller.getRenderItems()).toEqual([insufficientItem, sufficientItem]);
        expect(controller.shouldRender()).toBeTruthy();
      });

      it('without sufficient item', () => {
        const host = createLitElement();
        const controller = new StatusBarController(host);
        const insufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 1',
          sufficient: false,
        };
        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 2',
          sufficient: false,
        };

        controller.setItems([insufficientItem, sufficientItem]);
        expect(controller.getRenderItems()).toEqual([insufficientItem, sufficientItem]);
        expect(controller.shouldRender()).toBeFalsy();
      });
    });

    describe('should deal with popup styles correctly', () => {
      it('should show from empty to sufficient', () => {
        const host = createLitElement();
        setOrRemoveAttribute(host, true, 'hide');

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 1',
          priority: 100,
          sufficient: true,
        };

        controller.setItems([sufficientItem]);
        expect(host.getAttribute('hide')).toBe(null);
      });

      it('should not show from empty to insufficient', () => {
        const host = createLitElement();
        setOrRemoveAttribute(host, true, 'hide');

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const insufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 1',
          priority: 100,
          sufficient: false,
        };

        controller.setItems([insufficientItem]);
        expect(host.getAttribute('hide')).not.toBeNull();
      });

      it('should show from sufficient to different sufficient', () => {
        const host = createLitElement();

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const sufficientString = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'String',
          priority: 100,
          sufficient: true,
        };
        const sufficientIcon = {
          type: 'custom:advanced-camera-card-status-bar-icon' as const,
          icon: 'Icon',
          priority: 100,
          sufficient: true,
        };
        const sufficientImage = {
          type: 'custom:advanced-camera-card-status-bar-image' as const,
          image: 'Image',
          priority: 100,
          sufficient: true,
        };

        controller.setItems([sufficientString]);

        // Emulate the popup being hidden.
        setOrRemoveAttribute(host, true, 'hide');
        controller.setItems([sufficientIcon]);

        expect(host.getAttribute('hide')).toBe(null);

        // Emulate the popup being hidden.
        setOrRemoveAttribute(host, true, 'hide');
        controller.setItems([sufficientImage]);

        expect(host.getAttribute('hide')).toBe(null);
      });

      it('should not start popup timer when permanent items are present', () => {
        const host = createLitElement();
        setOrRemoveAttribute(host, true, 'hide');

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const permanentItem = {
          type: 'custom:advanced-camera-card-status-bar-icon' as const,
          icon: 'mdi:alert',
          sufficient: true,
          permanent: true,
        };

        controller.setItems([permanentItem]);
        expect(host.getAttribute('hide')).toBe(null);

        // Timer should not hide the bar.
        vi.advanceTimersByTime(10000);
        expect(host.getAttribute('hide')).toBe(null);
      });

      it('should start popup timer when permanent items are removed', () => {
        const host = createLitElement();

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const permanentItem = {
          type: 'custom:advanced-camera-card-status-bar-icon' as const,
          icon: 'mdi:alert',
          sufficient: true,
          permanent: true,
        };
        const nonPermanentItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Title',
          sufficient: true,
        };

        // Start with permanent item — bar stays visible.
        controller.setItems([permanentItem, nonPermanentItem]);
        vi.advanceTimersByTime(10000);
        expect(host.getAttribute('hide')).toBe(null);

        // Remove permanent item — popup timer starts.
        controller.setItems([nonPermanentItem]);
        expect(host.getAttribute('hide')).toBe(null);

        vi.advanceTimersByTime(3000);
        expect(host.getAttribute('hide')).not.toBe(null);
      });

      it('should start popup timer when permanent item is removed without changing sufficient items', () => {
        const host = createLitElement();

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Title',
          sufficient: true,
        };
        // A permanent item that is NOT sufficient — removing it does not
        // change the sufficient-values set, so the popup timer takes the
        // dedicated permanent-removal branch.
        const permanentInsufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-icon' as const,
          icon: 'mdi:alert',
          sufficient: false,
          permanent: true,
        };

        controller.setItems([sufficientItem, permanentInsufficientItem]);
        vi.advanceTimersByTime(10000);
        expect(host.getAttribute('hide')).toBe(null);

        // Remove the permanent (insufficient) item — sufficient values are
        // unchanged, but the popup timer must still start.
        controller.setItems([sufficientItem]);
        expect(host.getAttribute('hide')).toBe(null);

        vi.advanceTimersByTime(3000);
        expect(host.getAttribute('hide')).not.toBe(null);
      });

      it('should hide popup after expiry', () => {
        const host = createLitElement();

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string' as const,
          string: 'Item 1',
          priority: 100,
          sufficient: true,
        };

        controller.setItems([sufficientItem]);
        expect(host.getAttribute('hide')).toBe(null);

        vi.advanceTimersByTime(1000);
        expect(host.getAttribute('hide')).toBe(null);

        vi.advanceTimersByTime(2000);
        expect(host.getAttribute('hide')).not.toBe(null);
      });
    });
  });

  describe('should handle actions', () => {
    it('should bail without action', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new StatusBarController(host);
      controller.actionHandler(createInteractionActionEvent('tap'));
      expect(handler).not.toBeCalled();
    });

    it('should request action execution', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new StatusBarController(host);

      const action = {
        action: 'fire-dom-event' as const,
      };
      const tapActionConfig = {
        tap_action: action,
      };

      controller.actionHandler(createInteractionActionEvent('tap'), tapActionConfig);

      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { actions: [action], config: tapActionConfig },
        }),
      );
    });
  });
});
