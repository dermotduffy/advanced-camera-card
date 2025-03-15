import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuController } from '../../src/components-lib/menu-controller.js';
import { SubmenuItem } from '../../src/components/submenu/types.js';
import { MenuConfig, menuConfigSchema } from '../../src/config/types.js';
import {
  createInteractionActionEvent,
  createLitElement,
  createSubmenuInteractionActionEvent,
} from '../test-utils';

const createMenuConfig = (config: unknown): MenuConfig => {
  return menuConfigSchema.parse(config);
};

// @vitest-environment jsdom
describe('MenuController', () => {
  const action = {
    action: 'fire-dom-event' as const,
  };
  const menuToggleAction = {
    action: 'fire-dom-event' as const,
    advanced_camera_card_action: 'menu_toggle' as const,
  };
  const tapActionConfig = {
    camera_entity: 'foo',
    tap_action: action,
  };
  const tapActionConfigMulti = {
    camera_entity: 'foo',
    tap_action: [action, action, action],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set and get menu config', () => {
    const host = createLitElement();
    const controller = new MenuController(host);

    const config = createMenuConfig({
      button_size: 21,
      style: 'hover',
      position: 'left',
      alignment: 'top',
    });
    controller.setMenuConfig(config);
    expect(controller.getMenuConfig()).toBe(config);

    expect(host.style.getPropertyValue('--advanced-camera-card-menu-button-size')).toBe(
      '21px',
    );
    expect(host.getAttribute('data-style')).toBe('hover');
    expect(host.getAttribute('data-position')).toBe('left');
    expect(host.getAttribute('data-alignment')).toBe('top');
  });

  it('should expand', () => {
    const host = createLitElement();
    const controller = new MenuController(host);

    expect(controller.isExpanded()).toBeFalsy();
    expect(host.getAttribute('expanded')).toBeNull();

    controller.setExpanded(true);
    expect(controller.isExpanded()).toBeTruthy();
    expect(host.getAttribute('expanded')).toBe('');

    controller.setExpanded(false);
    expect(controller.isExpanded()).toBeFalsy();
    expect(host.getAttribute('expanded')).toBeNull();
  });

  describe('should set and sort buttons', () => {
    it('without a hidden menu', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(
        createMenuConfig({
          style: 'overlay',
        }),
      );

      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          priority: 20,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:goat',
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:chicken',
          priority: 40,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:horse',
          priority: 40,
          alignment: 'matching',

          // Will have no effect without a hidden menu.
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 30,
          alignment: 'matching',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:chicken',
          priority: 40,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:horse',
          priority: 40,
          alignment: 'matching',
          permanent: true,
        },
        {
          alignment: 'matching',
          icon: 'mdi:sheep',
          priority: 30,
          type: 'custom:advanced-camera-card-menu-icon',
        },
        {
          alignment: 'matching',
          icon: 'mdi:cow',
          priority: 20,
          type: 'custom:advanced-camera-card-menu-icon',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:goat',
          alignment: 'matching',
        },
      ]);
    });

    it('with an expanded hidden menu', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(
        createMenuConfig({
          style: 'hidden',
        }),
      );
      controller.setExpanded(true);
      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          priority: 99,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          alignment: 'matching',
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 100,
          alignment: 'matching',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          alignment: 'matching',
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 100,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          priority: 99,
          alignment: 'matching',
        },
      ]);
    });

    it('with a non-expanded hidden menu', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(
        createMenuConfig({
          style: 'hidden',
        }),
      );
      controller.setExpanded(false);
      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          priority: 100,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          alignment: 'matching',
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 100,
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          alignment: 'matching',
          priority: 100,
          permanent: true,
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          alignment: 'matching',
          priority: 100,
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          alignment: 'matching',
          permanent: true,
        },
      ]);
    });
  });

  describe('should get buttons', () => {
    it('with matching alignment', () => {
      const controller = new MenuController(createLitElement());
      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          alignment: 'opposing',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          alignment: 'matching',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
        },
      ]);
    });

    it('with disabled buttons', () => {
      const controller = new MenuController(createLitElement());
      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
          enabled: false,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:goat',
          enabled: true,
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:goat',
          enabled: true,
        },
      ]);
    });

    it('with hidden non-expanded menu', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(
        createMenuConfig({
          style: 'hidden',
        }),
      );

      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          permanent: true,
        },
      ]);

      controller.toggleExpanded();

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'iris',
          permanent: true,
        },
        {
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:sheep',
        },
      ]);
    });
  });

  describe('should handle actions', () => {
    it('should bail without config', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new MenuController(host);
      controller.handleAction(createInteractionActionEvent('tap'));
      expect(handler).not.toBeCalled();
    });

    it('should execute simple action in non-hidden menu', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new MenuController(host);

      controller.handleAction(createInteractionActionEvent('tap'), tapActionConfig);
      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { action: [action], config: tapActionConfig },
        }),
      );
      expect(controller.isExpanded()).toBeFalsy();
    });

    it('should execute simple action in with config in event', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new MenuController(host);

      controller.handleAction(
        createSubmenuInteractionActionEvent('tap', tapActionConfig as SubmenuItem),
      );
      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { action: [action], config: tapActionConfig },
        }),
      );
    });

    it('should execute simple array of actions in non-hidden menu', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:action:execution-request', handler);

      const controller = new MenuController(host);

      controller.handleAction(createInteractionActionEvent('tap'), tapActionConfigMulti);

      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { action: [action, action, action], config: tapActionConfigMulti },
        }),
      );
    });

    describe('should close menu', () => {
      it('tap', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.handleAction(createInteractionActionEvent('tap'), tapActionConfig);
        expect(controller.isExpanded()).toBeFalsy();
      });

      it('end_tap', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.handleAction(createInteractionActionEvent('end_tap'), {
          end_tap_action: action,
        });
        expect(controller.isExpanded()).toBeFalsy();
      });
    });

    describe('should not close menu', () => {
      it('start_tap with later action', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.handleAction(createInteractionActionEvent('start_tap'), {
          start_tap_action: action,
          end_tap_action: action,
        });
        expect(controller.isExpanded()).toBeTruthy();
      });

      it('with a menu toggle action', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(false);
        expect(controller.isExpanded()).toBeFalsy();

        controller.handleAction(createInteractionActionEvent('tap'), {
          camera_entity: 'foo',
          tap_action: menuToggleAction,
        });
        expect(controller.isExpanded()).toBeTruthy();
      });

      it('when no action is actually taken', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.handleAction(
          createInteractionActionEvent('end_tap'),
          tapActionConfig,
        );
        expect(controller.isExpanded()).toBeTruthy();
      });
    });
  });
});
