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
import type { CardController } from '../../../src/card-controller/controller';
import { TemplateRenderer } from '../../../src/card-controller/templates';
import { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import {
  createInternalCallbackAction,
  createLogAction,
} from '../../../src/utils/action';
import { arrayify } from '../../../src/utils/basic';
import { createCardAPI, createConfig, createHASS, createView } from '../../test-utils';

const createAPI = (): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getLockManager().getAllowedActions).mockImplementation((actions) =>
    arrayify(actions),
  );
  return api;
};

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

    it('should get no merged actions with an issue', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({ view: 'live' }),
      );
      vi.mocked(
        api.getIssueManager().getStateManager().hasFullCardIssue,
      ).mockReturnValue(true);

      const manager = new ActionsManager(api);

      expect(manager.getMergedActions()).toEqual({});
    });

    describe('should get merged actions with view', () => {
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
          'folder' as const,
          {
            tap_action: {
              action: 'navigate',
              // Folders also uses the media viewer.
              navigation_path: '4',
            },
          },
        ],
        [
          'folders' as const,
          {
            tap_action: {
              action: 'navigate',
              // Folders also uses the media gallery.
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
        const api = createAPI();
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
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle interaction', async () => {
      const api = createAPI();
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
          const api = createAPI();
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
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle advanced camera card event', async () => {
      const action = createLogAction('Hello, world!');
      const event = new CustomEvent('ll-custom', {
        detail: action,
      });

      const api = createAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleCustomActionEvent(event);
      expect(consoleSpy).toBeCalled();
    });

    it('should not handle generic event', async () => {
      const event = new CustomEvent('ll-custom', {
        detail: {
          type: 'fire-dom-event',
          foo: 'bar',
        },
      });

      const card = document.createElement('div');
      const handler = vi.fn();
      card.addEventListener('ll-custom', handler);

      const api = createAPI();
      vi.mocked(api.getCardElementManager().getElement).mockReturnValue(card);
      const manager = new ActionsManager(api);

      await manager.handleCustomActionEvent(event);

      expect(handler).not.toBeCalled();
    });

    it('should not handle event without detail', async () => {
      const manager = new ActionsManager(createAPI());

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleCustomActionEvent(new Event('ll-custom'));
      expect(consoleSpy).not.toBeCalled();
    });
  });

  describe('handleActionExecutionRequestEvent', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should execute actions', async () => {
      const api = createAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleActionExecutionRequestEvent(
        new CustomEvent('advanced-camera-card:action:execution-request', {
          detail: { actions: createLogAction('Hello, world!') },
        }),
      );
      expect(consoleSpy).toBeCalled();
    });
  });

  describe('executeAction', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should execute actions', async () => {
      const api = createAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.executeActions({ actions: createLogAction('Hello, world!') });
      expect(consoleSpy).toBeCalled();
    });

    it('should execute actions', async () => {
      const api = createAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.executeActions({ actions: createLogAction('Hello, world!') });
      expect(consoleSpy).toBeCalled();
    });

    it('should render templates', async () => {
      const action = createLogAction('{{ acc.camera }}');

      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(action);

      const api = createAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const conditionState = {
        camera: 'camera',
      };
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue(conditionState);

      const manager = new ActionsManager(api, templateRenderer);
      const config = { entity: 'light.office' };
      const triggerData = {
        platform: 'acc',
        type: 'view',
        from_acc: { view: 'previous-view' },
        to_acc: { view: 'view' },
      };
      vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      await manager.executeActions({ actions: action, config, triggerData });

      expect(templateRenderer.renderRecursively).toBeCalledWith(hass, action, {
        conditionState,
        triggerData,
      });
    });

    it('should filter actions through the lock manager before rendering them', async () => {
      const rawRan = vi.fn();
      const allowedRan = vi.fn();
      const rawAction = createInternalCallbackAction(async () => {
        rawRan();
      });
      const allowedAction = createInternalCallbackAction(async () => {
        allowedRan();
      });

      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(allowedAction);

      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getLockManager().getAllowedActions).mockReturnValue([allowedAction]);

      const manager = new ActionsManager(api, templateRenderer);

      await manager.executeActions({ actions: rawAction });

      // The lock manager sees the raw (unrendered) action; only the action it
      // returns is rendered and run.
      expect(api.getLockManager().getAllowedActions).toBeCalledWith(rawAction);
      expect(allowedRan).toBeCalled();
      expect(rawRan).not.toBeCalled();
    });

    it('should let an action observe state a prior action changed', async () => {
      const observed: string[] = [];
      let camera = 'first';

      const templateRenderer = mock<TemplateRenderer>();

      // The first action changes the selected camera; the second records the
      // camera in the condition state at the moment it is rendered.
      templateRenderer.renderRecursively
        .mockReturnValueOnce(
          createInternalCallbackAction(async () => {
            camera = 'second';
          }),
        )
        .mockImplementationOnce((_hass, _action, options) => {
          const rendered = String(options?.conditionState?.camera);
          return createInternalCallbackAction(async () => {
            observed.push(rendered);
          });
        });

      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConditionStateManager().getState).mockImplementation(() => ({
        camera,
      }));

      const manager = new ActionsManager(api, templateRenderer);

      // The inputs are placeholders; the mocked renderer above maps each to a
      // recorder, so their content is irrelevant.
      await manager.executeActions({
        actions: [{ action: 'none' }, { action: 'none' }],
      });

      // The second action rendered against the camera the first action set.
      expect(observed).toEqual(['second']);
    });

    it('should render against the hass available at each step', async () => {
      const ran: string[] = [];

      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively.mockReturnValue(
        createInternalCallbackAction(async () => {
          ran.push('rendered');
        }),
      );

      const api = createAPI();

      // No HASS for the first action; HASS for the second.
      vi.mocked(api.getHASSManager().getHASS)
        .mockReturnValueOnce(null)
        .mockReturnValue(createHASS());

      const manager = new ActionsManager(api, templateRenderer);

      await manager.executeActions({
        actions: [
          createInternalCallbackAction(async () => {
            ran.push('raw');
          }),
          { action: 'none' },
        ],
      });

      // The first action ran unrendered (no HASS yet); the second rendered once
      // HASS became available, so HASS is read per action, not captured once.
      expect(ran).toEqual(['raw', 'rendered']);
      expect(templateRenderer.renderRecursively).toBeCalledTimes(1);
    });

    it('should abort the remaining actions when one fails to render', async () => {
      const first = vi.fn();
      const third = vi.fn();

      const templateRenderer = mock<TemplateRenderer>();
      templateRenderer.renderRecursively
        .mockReturnValueOnce(
          createInternalCallbackAction(async () => {
            first();
          }),
        )
        .mockImplementationOnce(() => {
          throw new Error('second: bad template');
        })
        .mockReturnValueOnce(
          createInternalCallbackAction(async () => {
            third();
          }),
        );

      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ActionsManager(api, templateRenderer);
      const warnSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      // The inputs are placeholders; the mocked renderer above maps each to a
      // recorder (or a throw), so their content is irrelevant.
      await manager.executeActions({
        actions: [{ action: 'none' }, { action: 'none' }, { action: 'none' }],
      });

      // The first action ran; the render failure aborted the rest, and the
      // error was caught by executeActions (warning haptic + console).
      expect(first).toBeCalled();
      expect(third).not.toBeCalled();
      expect(warnSpy).toBeCalled();
    });

    it('should render an if-action branch against the trigger data', async () => {
      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({
        fullscreen: true,
      });

      // A real renderer so the branch's `{{ trigger.* }}` template resolves.
      const manager = new ActionsManager(api, new TemplateRenderer());
      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      await manager.executeActions({
        actions: {
          if: [{ condition: 'fullscreen', fullscreen: true }],
          then: [createLogAction('{{ trigger.entity_id }}')],
        },
        triggerData: { platform: 'state', entity_id: 'binary_sensor.door' },
      });

      // The branch is rendered with the trigger data before the if-action hands
      // it to the nested executor (which then runs it without re-rendering).
      expect(api.getActionsManager().executeActions).toBeCalledWith(
        { actions: [createLogAction('binary_sensor.door')], config: undefined },
        false,
      );

      // The log action is handed to the (mocked) nested executor, not run here,
      // so it must not actually log.
      expect(consoleSpy).not.toBeCalled();
    });

    it('should not execute actions when the lock manager rejects them', async () => {
      const api = createAPI();
      vi.mocked(api.getLockManager().getAllowedActions).mockReturnValue([]);

      const manager = new ActionsManager(api);
      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      await manager.executeActions({ actions: createLogAction('Blocked') });

      expect(consoleSpy).not.toBeCalled();
    });

    describe('should forward haptics', () => {
      afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
      });

      it('should forward success haptic', async () => {
        const handler = vi.fn();
        window.addEventListener('haptic', handler);

        const api = createAPI();
        const manager = new ActionsManager(api);

        await manager.executeActions({ actions: { action: 'none' } });

        expect(handler).toBeCalledWith(expect.objectContaining({ detail: 'success' }));
      });

      it('should forward warning haptic', async () => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const handler = vi.fn();
        window.addEventListener('haptic', handler);

        const api = createAPI();
        const manager = new ActionsManager(api);

        vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

        await manager.executeActions({
          actions: { action: 'none', confirmation: true },
        });

        expect(handler).toBeCalledWith(expect.objectContaining({ detail: 'warning' }));
      });
    });
  });

  describe('uninitialize', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });
    afterAll(() => {
      vi.useRealTimers();
    });

    it('should stop actions', async () => {
      const api = createAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      const promise = manager.executeActions({
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'sleep',
            duration: {
              m: 1,
            },
          },
          createLogAction('Hello, world!'),
        ],
      });

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
