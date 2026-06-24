import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { CardController } from '../../src/card-controller/controller';
import { DefaultManager } from '../../src/card-controller/default-manager';
import { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher';
import {
  callStateWatcherCallback,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
} from '../test-utils';

const createCardAPIWithStateWatcher = (): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getHASSManager().getStateWatcher).mockReturnValue(
    mock<StateWatcherSubscriptionInterface>(),
  );
  return api;
};

// @vitest-environment jsdom
describe('DefaultManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('time based', () => {
    it('should set default view when allowed', async () => {
      const api = createCardAPIWithStateWatcher();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 10,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(true);

      vi.useFakeTimers();

      const manager = new DefaultManager(api);
      await manager.initialize();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);

      manager.uninitialize();
      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);
    });

    it('should not set default view when not configured', () => {
      const api = createCardAPIWithStateWatcher();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 0,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

      vi.useFakeTimers();

      const manager = new DefaultManager(api);
      manager.initialize();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });

    it('should restart timer when reconfigured', async () => {
      const api = createCardAPIWithStateWatcher();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 10,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

      vi.useFakeTimers();

      const manager = new DefaultManager(api);

      await manager.initialize();
      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      await manager.initialize();
      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).toBeCalled();
    });
  });

  it('should set default view when state changed', async () => {
    const api = createCardAPIWithStateWatcher();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          default_reset: {
            entities: ['binary_sensor.foo'],
            every_seconds: 10,
          },
        },
      }),
    );
    vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const manager = new DefaultManager(api);
    await manager.initialize();

    callStateWatcherCallback(api.getHASSManager().getStateWatcher(), {
      entityID: 'binary_sensor.foo',
      oldState: createStateEntity({ state: 'off' }),
      newState: createStateEntity({ state: 'on' }),
    });

    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  describe('interaction based', () => {
    it('should not register automation on initialization', async () => {
      const api = createCardAPIWithStateWatcher();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              after_interaction: false,
            },
          },
        }),
      );

      const manager = new DefaultManager(api);
      await manager.initialize();

      expect(api.getAutomationsManager().addAutomations).not.toBeCalled();
    });

    it('should register automation on initialization', async () => {
      const api = createCardAPIWithStateWatcher();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              after_interaction: true,
            },
          },
        }),
      );

      const manager = new DefaultManager(api);
      await manager.initialize();

      expect(api.getAutomationsManager().addAutomations).toBeCalledWith([
        {
          actions: [
            {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'default',
            },
          ],
          triggers: [
            {
              trigger: 'interaction',
              interaction: false,
            },
          ],
          tag: expect.anything(),
        },
      ]);
    });

    it('should remove automation on uninitalize', () => {
      const api = createCardAPIWithStateWatcher();
      const manager = new DefaultManager(api);
      manager.uninitialize();

      expect(api.getAutomationsManager().deleteAutomations).toBeCalledWith(manager);
    });
  });

  it('should reinitialize when there is a config change', async () => {
    const configOn = createConfig({
      view: {
        default_reset: {
          every_seconds: 10,
        },
      },
    });
    const configOff = createConfig({
      view: {
        default_reset: {
          every_seconds: 0,
        },
      },
    });

    const api = createCardAPIWithStateWatcher();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

    vi.useFakeTimers();

    const manager = new DefaultManager(api);

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(configOn);
    await manager.initializeIfNecessary(null);

    vi.runOnlyPendingTimers();
    expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(configOff);
    await manager.initializeIfNecessary(configOn);

    vi.runOnlyPendingTimers();
    expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(configOff);
    await manager.initializeIfNecessary(configOff);

    vi.runOnlyPendingTimers();
    expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);
  });
});
