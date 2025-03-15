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
import { mock } from 'vitest-mock-extended';
import {
  ActionsManager,
  Interaction,
  InteractionName,
} from '../../../src/card-controller/actions/actions-manager';
import { TemplateRenderer } from '../../../src/card-controller/templates';
import { AdvancedCameraCardView } from '../../../src/config/types';
import { createLogAction } from '../../../src/utils/action';
import { createCardAPI, createConfig, createHASS, createView } from '../../test-utils';

describe('ActionsManager', () => {
  describe('getMergedActions', () => {
    const config = {
      view: {
        actions: {
          tap_action: {
            action: 'navigate',
            navigation_path: '1',
          },
        },
      },
      live: {
        actions: {
          tap_action: {
            action: 'navigate',
            navigation_path: '2',
          },
        },
      },
      media_gallery: {
        actions: {
          tap_action: {
            action: 'navigate',
            navigation_path: '3',
          },
        },
      },
      media_viewer: {
        actions: {
          tap_action: {
            action: 'navigate',
            navigation_path: '4',
          },
        },
      },
      image: {
        actions: {
          tap_action: {
            action: 'navigate',
            navigation_path: '5',
          },
        },
      },
    };

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should get no merged actions with a message', () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({ view: 'live' }),
      );
      vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(true);

      const manager = new ActionsManager(api);

      expect(manager.getMergedActions()).toEqual({});
    });

    describe('should get merged actions with live view', () => {
      it.each([
        [
          'live' as const,
          {
            tap_action: {
              action: 'navigate',
              navigation_path: '2',
            },
          },
        ],
        [
          'clips' as const,
          {
            tap_action: {
              action: 'navigate',
              navigation_path: '3',
            },
          },
        ],
        [
          'clip' as const,
          {
            tap_action: {
              action: 'navigate',
              navigation_path: '4',
            },
          },
        ],
        [
          'image' as const,
          {
            tap_action: {
              action: 'navigate',
              navigation_path: '5',
            },
          },
        ],
        ['timeline' as const, {}],
      ])('%s', (viewName: AdvancedCameraCardView, result: Record<string, unknown>) => {
        const api = createCardAPI();
        vi.mocked(api.getViewManager().getView).mockReturnValue(
          createView({ view: viewName }),
        );
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig(config),
        );

        const manager = new ActionsManager(api);

        expect(manager.getMergedActions()).toEqual(result);
      });
    });
  });

  // @vitest-environment jsdom
  describe('handleInteractionEvent', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle interaction', async () => {
      const api = createCardAPI();
      const element = document.createElement('div');
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            actions: {
              tap_action: createLogAction('Hello, world!'),
            },
          },
        }),
      );
      const manager = new ActionsManager(api);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleInteractionEvent(
        new CustomEvent<Interaction>('event', { detail: { action: 'tap' } }),
      );
      expect(consoleSpy).toBeCalled();
    });

    describe('should handle unexpected interactions', () => {
      it.each([['malformed_type_of_tap' as const], ['double_tap' as const]])(
        '%s',
        (interaction: string) => {
          const api = createCardAPI();
          const element = document.createElement('div');
          vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
          vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
          vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
            createConfig({
              view: {
                actions: {
                  tap_action: createLogAction('Hello, world!'),
                },
              },
            }),
          );
          const manager = new ActionsManager(api);

          const hass = createHASS();
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

          const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
          manager.handleInteractionEvent(
            new CustomEvent<Interaction>('event', {
              detail: { action: interaction as unknown as InteractionName },
            }),
          );
          expect(consoleSpy).not.toBeCalled();
        },
      );
    });
  });

  describe('handleCustomActionEvent', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle event', async () => {
      const action = createLogAction('Hello, world!');
      const event = new CustomEvent('ll-custom', {
        detail: action,
      });

      const api = createCardAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleCustomActionEvent(event);
      expect(consoleSpy).toBeCalled();
    });

    it('should not handle event without detail', async () => {
      const manager = new ActionsManager(createCardAPI());

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleCustomActionEvent(new Event('ll-custom'));
      expect(consoleSpy).not.toBeCalled();
    });
  });

  describe('handleActionExecutionRequestEvent', () => {
    it('should execute actions', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleActionExecutionRequestEvent(
        new CustomEvent('advanced-camera-card:action:execution-request', {
          detail: { action: createLogAction('Hello, world!') },
        }),
      );
      expect(consoleSpy).toBeCalled();
    });
  });

  describe('executeAction', () => {
    it('should execute actions', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.executeActions(createLogAction('Hello, world!'));
      expect(consoleSpy).toBeCalled();
    });

    it('should execute actions', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.executeActions(createLogAction('Hello, world!'));
      expect(consoleSpy).toBeCalled();
    });

    it('should render templates', async () => {
      const action = createLogAction('{{ acc.camera }}');

      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(action);

      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const conditionState = {
        camera: 'camera',
      };
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue(conditionState);

      const manager = new ActionsManager(api, templateRenderer);
      const config = { entity: 'light.office' };
      const triggerData = { view: { from: 'previous-view', to: 'view' } };

      await manager.executeActions(action, {
        config,
        triggerData,
      });

      expect(templateRenderer.renderRecursively).toBeCalledWith(hass, action, {
        conditionState,
        triggerData,
      });
    });

    describe('should forward haptics', () => {
      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should forward success haptic', async () => {
        const handler = vi.fn();
        window.addEventListener('haptic', handler);

        const api = createCardAPI();
        const manager = new ActionsManager(api);

        await manager.executeActions({ action: 'none' });

        expect(handler).toBeCalledWith(expect.objectContaining({ detail: 'success' }));
      });

      it('should forward warning haptic', async () => {
        const handler = vi.fn();
        window.addEventListener('haptic', handler);

        const api = createCardAPI();
        const manager = new ActionsManager(api);

        vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

        await manager.executeActions({ action: 'none', confirmation: true });

        expect(handler).toBeCalledWith(expect.objectContaining({ detail: 'warning' }));
      });
    });
  });

  describe('uninitialize', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });
    afterAll(() => {
      vi.useRealTimers();
    });

    it('should stop actions', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      const promise = manager.executeActions([
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'sleep',
          duration: {
            m: 1,
          },
        },
        createLogAction('Hello, world!'),
      ]);

      // Stop inflight actions.
      await manager.uninitialize();

      // Advance timers (causes the sleep to end).
      vi.runOnlyPendingTimers();

      await promise;

      // Action set will not continue.
      expect(consoleSpy).not.toBeCalled();
    });
  });
});
