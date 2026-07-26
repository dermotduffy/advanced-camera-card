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
  ActionsManager,
  type Interaction,
  type InteractionName,
} from '../../../src/card-controller/actions/actions-manager';
import type { CardController } from '../../../src/card-controller/controller';
import { TemplateManager } from '../../../src/card-controller/templates';
import type { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import {
  createInternalCallbackAction,
  createLogAction,
} from '../../../src/utils/action';
import { arrayify } from '../../../src/utils/basic';
import { createConfig } from '../../config/test-utils';
import {
  createCardAPI,
  createHASS,
  createMockTemplateRenderer,
  stubConnectedHomeAssistant,
} from '../../test-utils';
import { createView } from '../../view/test-utils';

const createAPI = (): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getLockManager().getAllowedActions).mockImplementation((actions) =>
    arrayify(actions),
  );
  return api;
};

// @vitest-environment jsdom
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

  describe('handleInteractionEvent', () => {
    // Templated actions render through ha-nunjucks, which polls (via setTimeout)
    // for a connected `home-assistant` element until ready. Stubbing one makes
    // it resolve synchronously, so no retry timer leaks past test teardown.
    beforeAll(() => {
      stubConnectedHomeAssistant();
    });
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
      expect(consoleSpy).toHaveBeenCalled();
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
          expect(consoleSpy).not.toHaveBeenCalled();
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
      expect(consoleSpy).toHaveBeenCalled();
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

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not handle event without detail', async () => {
      const manager = new ActionsManager(createAPI());

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.handleCustomActionEvent(new Event('ll-custom'));
      expect(consoleSpy).not.toHaveBeenCalled();
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
      expect(consoleSpy).toHaveBeenCalled();
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
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should execute actions', async () => {
      const api = createAPI();
      const manager = new ActionsManager(api);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
      await manager.executeActions({ actions: createLogAction('Hello, world!') });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should render templates', async () => {
      const action = createLogAction('{{ acc.camera }}');

      const api = createAPI();
      vi.mocked(api.getTemplateManager).mockReturnValue(createMockTemplateRenderer());

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const conditionState = {
        camera: 'camera',
      };
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue(conditionState);

      const manager = new ActionsManager(api);
      const config = { entity: 'light.office' };
      const triggerData = {
        platform: 'acc',
        type: 'view',
        from_acc: { view: 'previous-view' },
        to_acc: { view: 'view' },
      };
      vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      await manager.executeActions({ actions: action, config, triggerData });

      expect(
        vi.mocked(api.getTemplateManager().renderRecursivelyAsType),
      ).toHaveBeenCalledWith(hass, action, {
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

      const api = createAPI();
      vi.mocked(api.getTemplateManager).mockReturnValue(createMockTemplateRenderer());
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getLockManager().getAllowedActions).mockReturnValue([allowedAction]);

      const manager = new ActionsManager(api);

      await manager.executeActions({ actions: rawAction });

      // The lock manager sees the raw (unrendered) action; only the action it
      // returns is rendered and run.
      expect(api.getLockManager().getAllowedActions).toHaveBeenCalledWith([rawAction]);
      expect(allowedRan).toHaveBeenCalled();
      expect(rawRan).not.toHaveBeenCalled();
    });

    it('should render each action against the state at its turn', async () => {
      let camera = 'first';

      const api = createAPI();
      // The mock renderer passes values through, so assert on the render
      // *inputs*, not a swapped output.
      vi.mocked(api.getTemplateManager).mockReturnValue(createMockTemplateRenderer());
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConditionStateManager().getState).mockImplementation(() => ({
        camera,
      }));

      const manager = new ActionsManager(api);

      await manager.executeActions({
        actions: [
          // The first action changes the camera...
          createInternalCallbackAction(async () => {
            camera = 'second';
          }),
          // ...the second is rendered afterwards.
          { action: 'none' },
        ],
      });

      // Each action renders with the state as it is at its turn: the second
      // sees the camera the first action set.
      expect(
        vi.mocked(api.getTemplateManager().renderRecursivelyAsType),
      ).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ conditionState: { camera: 'first' } }),
      );
      expect(
        vi.mocked(api.getTemplateManager().renderRecursivelyAsType),
      ).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ conditionState: { camera: 'second' } }),
      );
    });

    it('should render against the hass available at each step', async () => {
      const ran: string[] = [];

      const api = createAPI();
      vi.mocked(api.getTemplateManager).mockReturnValue(createMockTemplateRenderer());
      // No HASS for the first action's render; HASS thereafter.
      vi.mocked(api.getHASSManager().getHASS)
        .mockReturnValueOnce(null)
        .mockReturnValue(createHASS());

      const manager = new ActionsManager(api);

      await manager.executeActions({
        actions: [
          createInternalCallbackAction(async () => {
            ran.push('one');
          }),
          createInternalCallbackAction(async () => {
            ran.push('two');
          }),
        ],
      });

      // Both actions ran; only the second was rendered -- the first saw no
      // HASS, so HASS is read per action rather than captured once.
      expect(ran).toEqual(['one', 'two']);
      expect(
        vi.mocked(api.getTemplateManager().renderRecursivelyAsType),
      ).toHaveBeenCalledTimes(1);
    });

    it('should abort the remaining actions when one fails to render', async () => {
      const ran: string[] = [];

      const api = createAPI();
      const renderer = createMockTemplateRenderer();
      vi.mocked(api.getTemplateManager).mockReturnValue(renderer);

      // The second action's render throws, to exercise a mid-sequence failure.
      vi.mocked(renderer.renderRecursivelyAsType)
        .mockImplementationOnce((_hass, data) => data)
        .mockImplementationOnce(() => {
          throw new Error('bad template');
        });
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ActionsManager(api);
      const warnSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      await manager.executeActions({
        actions: [
          createInternalCallbackAction(async () => {
            ran.push('first');
          }),
          createInternalCallbackAction(async () => {
            ran.push('second');
          }),
          createInternalCallbackAction(async () => {
            ran.push('third');
          }),
        ],
      });

      // The first action ran; the second's render threw, aborting the rest. The
      // error was caught by executeActions().
      expect(ran).toEqual(['first']);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should hand an if-action branch to the executor unrendered, with the trigger data', async () => {
      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({
        fullscreen: true,
      });

      // The if-action renders its own (non-branch) fields, so give it an
      // identity renderer that passes the config through unchanged.
      vi.mocked(api.getTemplateManager).mockReturnValue(createMockTemplateRenderer());

      const manager = new ActionsManager(api);
      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      const thenAction = createLogAction('{{ trigger.entity_id }}');
      await manager.executeActions({
        actions: {
          if: [{ condition: 'fullscreen', fullscreen: true }],
          then: [thenAction],
          else: [createLogAction('unused else')],
        },
        triggerData: { platform: 'state', entity_id: 'binary_sensor.door' },
      });

      // The branch is left raw (template intact) and forwarded with the trigger
      // data, so the nested executor renders it per-step when it runs -- not
      // frozen against the state at the `if` step.
      expect(api.getActionsManager().executeNestedActions).toHaveBeenCalledWith({
        actions: [thenAction],
        config: undefined,
        triggerData: { platform: 'state', entity_id: 'binary_sensor.door' },
      });

      // The log action is handed to the (mocked) nested executor, not run here,
      // so it must not actually log.
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should render if-action branch actions per-step', async () => {
      let camera = 'before';

      // This case renders a real branch template, so load the lazily-imported
      // engine for the synchronous renderer.
      const templateManager = new TemplateManager();
      await templateManager.loadRenderer();

      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConditionStateManager().getState).mockImplementation(() => ({
        camera,
        fullscreen: true,
      }));
      vi.mocked(api.getTemplateManager).mockReturnValue(templateManager);

      const manager = new ActionsManager(api);
      // The if-action's nested executor is the same (real) manager.
      vi.mocked(api.getActionsManager).mockReturnValue(manager);

      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      await manager.executeActions({
        actions: {
          if: [{ condition: 'fullscreen', fullscreen: true }],
          then: [
            // The first branch action changes the camera...
            createInternalCallbackAction(async () => {
              camera = 'after';
            }),
            // ...the second logs `{{ acc.camera }}`, rendered at its own turn.
            createLogAction('{{ acc.camera }}'),
          ],
        },
      });

      // The log rendered against the camera the first branch action set, so it
      // logs 'after' -- proving the branch renders per-step. Frozen-at-the-`if`
      // rendering would log 'before'.
      expect(consoleSpy).toHaveBeenCalledWith('after');
    });

    it('should drop an action whose templated discriminator cannot be classified', async () => {
      const api = createAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = new ActionsManager(api);
      const warnSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      await manager.executeActions({
        actions: {
          action: 'fire-dom-event',
          advanced_camera_card_action: '{{ acc.view }}',
        },
      });

      // The discriminator is classified on the raw action (templates render
      // only afterwards), so a templated `advanced_camera_card_action` matches
      // no action type and is dropped with a warning rather than executed.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown card action'),
      );
    });

    it('should not execute actions when the lock manager rejects them', async () => {
      const api = createAPI();
      vi.mocked(api.getLockManager().getAllowedActions).mockReturnValue([]);

      const manager = new ActionsManager(api);
      const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);

      await manager.executeActions({ actions: createLogAction('Blocked') });

      expect(consoleSpy).not.toHaveBeenCalled();
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

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({ detail: 'success' }),
        );
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

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({ detail: 'warning' }),
        );
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
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
