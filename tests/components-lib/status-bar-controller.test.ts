import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { StatusBarController } from '../../src/components-lib/status-bar-controller';
import { StatusBarConfig, statusBarConfigSchema } from '../../src/config/types';
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
          type: 'custom:advanced-camera-card-status-bar-string',
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
        type: 'custom:advanced-camera-card-status-bar-string',
        string: 'Item 1',
        priority: 40,
      };
      const item2 = {
        type: 'custom:advanced-camera-card-status-bar-string',
        string: 'Item 2',
        priority: 10,
      };
      const item3 = {
        type: 'custom:advanced-camera-card-status-bar-string',
        string: 'Item 3',
        priority: 60,
      };
      const item4 = {
        type: 'custom:advanced-camera-card-status-bar-string',
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
        type: 'custom:advanced-camera-card-status-bar-string',
        string: 'Item 1',
        priority: 100,
      };
      const exclusiveItem = {
        type: 'custom:advanced-camera-card-status-bar-string',
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
          type: 'custom:advanced-camera-card-status-bar-string',
          string: 'Item 1',
          sufficient: false,
        };
        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string',
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
          type: 'custom:advanced-camera-card-status-bar-string',
          string: 'Item 1',
          sufficient: false,
        };
        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string',
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
          type: 'custom:advanced-camera-card-status-bar-string',
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
          type: 'custom:advanced-camera-card-status-bar-string',
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
          type: 'custom:advanced-camera-card-status-bar-string',
          string: 'String',
          priority: 100,
          sufficient: true,
        };
        const sufficientIcon = {
          type: 'custom:advanced-camera-card-status-bar-icon',
          icon: 'Icon',
          priority: 100,
          sufficient: true,
        };
        const sufficientImage = {
          type: 'custom:advanced-camera-card-status-bar-image',
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

      it('should hide popup after expiry', () => {
        const host = createLitElement();

        const controller = new StatusBarController(host);
        controller.setConfig(
          createConfig({
            style: 'popup',
          }),
        );

        const sufficientItem = {
          type: 'custom:advanced-camera-card-status-bar-string',
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
          detail: { action: [action], config: tapActionConfig },
        }),
      );
    });
  });
});
