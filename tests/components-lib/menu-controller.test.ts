import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { LockManager } from '../../src/card-controller/lock/manager';
import type { LockManagerEpoch } from '../../src/card-controller/lock/types';
import { MenuController } from '../../src/components-lib/menu-controller.js';
import { SubmenuItem } from '../../src/components/submenu/types.js';
import { MenuConfig, menuConfigSchema } from '../../src/config/schema/menu.js';
import {
  createInteractionActionEvent,
  createLitElement,
  createSubmenuInteractionActionEvent,
} from '../test-utils';

const createMenuConfig = (config: unknown): MenuConfig => {
  return menuConfigSchema.parse(config);
};

const createLock = (locked: boolean, actionsBlocked: boolean): LockManagerEpoch => {
  const lockManager = mock<LockManager>();
  lockManager.areAllActionsBlocked.mockReturnValue(actionsBlocked);
  return { manager: lockManager, locked };
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

  describe('setLockManagerEpoch', () => {
    it('should trigger update on first lock change', () => {
      const host = createLitElement();
      const controller = new MenuController(host);
      vi.mocked(host.requestUpdate).mockClear();

      controller.setLockManagerEpoch(createLock(true, true));
      expect(host.requestUpdate).toBeCalledTimes(1);
    });

    it('should not trigger update when lock epoch is unchanged', () => {
      const host = createLitElement();
      const controller = new MenuController(host);
      const lock = createLock(false, true);
      controller.setLockManagerEpoch(lock);
      vi.mocked(host.requestUpdate).mockClear();

      controller.setLockManagerEpoch({ manager: lock.manager, locked: lock.locked });
      expect(host.requestUpdate).not.toBeCalled();
    });

    it('should reflect lock state in shouldButtonBeInert', () => {
      const controller = new MenuController(createLitElement());
      controller.setLockManagerEpoch(createLock(false, true));
      const button = {
        type: 'custom:advanced-camera-card-menu-icon' as const,
        icon: 'mdi:cow',
        tap_action: {
          action: 'fire-dom-event' as const,
          advanced_camera_card_action: 'camera_select' as const,
          camera: 'cam-1',
        },
      };

      expect(controller.shouldButtonBeInert(button)).toBeFalsy();
      controller.setLockManagerEpoch(createLock(true, true));
      expect(controller.shouldButtonBeInert(button)).toBeTruthy();
      controller.setLockManagerEpoch(createLock(false, true));
      expect(controller.shouldButtonBeInert(button)).toBeFalsy();
    });
  });

  describe('shouldButtonBeInert', () => {
    const blockedAction = {
      action: 'fire-dom-event' as const,
      advanced_camera_card_action: 'camera_select' as const,
      camera: 'cam-1',
    };
    const unblockedAction = {
      action: 'fire-dom-event' as const,
      advanced_camera_card_action: 'fullscreen' as const,
    };

    it('should always return true when user explicitly set `inert: true`', () => {
      const controller = new MenuController(createLitElement());
      const button = {
        type: 'custom:advanced-camera-card-menu-icon' as const,
        icon: 'mdi:cow',
        inert: true,
        tap_action: unblockedAction,
      };

      // Without the lock active.
      expect(controller.shouldButtonBeInert(button)).toBeTruthy();
      // With the lock active.
      controller.setLockManagerEpoch(createLock(true, false));
      expect(controller.shouldButtonBeInert(button)).toBeTruthy();
    });

    it('should return false when lock is inactive and button is not user-inert', () => {
      const controller = new MenuController(createLitElement());
      expect(
        controller.shouldButtonBeInert({
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          tap_action: blockedAction,
        }),
      ).toBeFalsy();
    });

    it('should never mark submenu containers inert (even when all actions are blocked)', () => {
      const controller = new MenuController(createLitElement());
      controller.setLockManagerEpoch(createLock(true, true));

      expect(
        controller.shouldButtonBeInert({
          type: 'custom:advanced-camera-card-menu-submenu',
          icon: 'mdi:menu',
          items: [],
          tap_action: blockedAction,
        }),
      ).toBeFalsy();
      expect(
        controller.shouldButtonBeInert({
          type: 'custom:advanced-camera-card-menu-submenu-select',
          icon: 'mdi:menu',
          entity: 'select.foo',
          state_color: true,
          tap_action: blockedAction,
        }),
      ).toBeFalsy();
    });

    it('should mark icon buttons inert when locked and all actions are blocked', () => {
      const controller = new MenuController(createLitElement());
      controller.setLockManagerEpoch(createLock(true, true));

      expect(
        controller.shouldButtonBeInert({
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          tap_action: blockedAction,
        }),
      ).toBeTruthy();
    });

    it('should NOT mark icon buttons inert when locked and not all actions are blocked', () => {
      const controller = new MenuController(createLitElement());
      controller.setLockManagerEpoch(createLock(true, false));

      expect(
        controller.shouldButtonBeInert({
          type: 'custom:advanced-camera-card-menu-icon',
          icon: 'mdi:cow',
          tap_action: blockedAction,
          hold_action: unblockedAction,
        }),
      ).toBeFalsy();
    });
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

    it('with identical buttons to avoid unnecessary updates', () => {
      const host = createLitElement();
      const controller = new MenuController(host);

      const buttons = [
        {
          type: 'custom:advanced-camera-card-menu-icon' as const,
          icon: 'mdi:cow',
        },
      ];

      controller.setButtons(buttons);
      expect(host.requestUpdate).toBeCalledTimes(1);

      controller.setButtons([
        {
          type: 'custom:advanced-camera-card-menu-icon' as const,
          icon: 'mdi:cow',
        },
      ]);
      expect(host.requestUpdate).toBeCalledTimes(1);
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
          detail: { actions: [action], config: tapActionConfig },
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
          detail: { actions: [action], config: tapActionConfig },
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
          detail: { actions: [action, action, action], config: tapActionConfigMulti },
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

  describe('auto-hide', () => {
    it('should not render before a config is set', () => {
      const controller = new MenuController(createLitElement());
      expect(controller.shouldRender()).toBe(false);
    });

    it('should not render when the style is none', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(createMenuConfig({ style: 'none' }));
      expect(controller.shouldRender()).toBe(false);
    });

    it('should render with a config and no auto-hide state', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(createMenuConfig({ auto_hide: ['call'] }));
      expect(controller.shouldRender()).toBe(true);
    });

    it('should render when no auto-hide condition is active', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(createMenuConfig({ auto_hide: ['call'] }));
      controller.setAutoHideState({ call: false, casting: true });
      expect(controller.shouldRender()).toBe(true);
    });

    it('should not render when a configured auto-hide condition is active', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(createMenuConfig({ auto_hide: ['call'] }));
      controller.setAutoHideState({ call: true, casting: false });
      expect(controller.shouldRender()).toBe(false);
    });
  });
});
