import { add } from 'date-fns';
import { PartialDeep } from 'type-fest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardController } from '../../src/card-controller/controller';
import { TriggersManager } from '../../src/card-controller/triggers-manager';
import { AdvancedCameraCardView } from '../../src/config/schema/common/const';
import { TriggersOptions, triggersSchema } from '../../src/config/schema/view';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createStore,
  createView,
  flushPromises,
} from '../test-utils';

vi.mock('lodash-es', async () => ({
  ...(await vi.importActual('lodash-es')),
  throttle: vi.fn((fn) => fn),
}));

const baseTriggersConfig: TriggersOptions = {
  untrigger_seconds: 10,
  filter_selected_camera: false,
  show_trigger_status: false,
  actions: {
    trigger: 'update' as const,
    untrigger: 'default' as const,
    interaction_mode: 'inactive' as const,
  },
};

const createTriggerAPI = (options?: {
  config?: PartialDeep<TriggersOptions>;
  default?: AdvancedCameraCardView;
  interaction?: boolean;
}): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({
      view: {
        triggers: options?.config
          ? triggersSchema.parse({
              ...baseTriggersConfig,
              ...options.config,
              actions: {
                ...baseTriggersConfig.actions,
                ...options.config.actions,
              },
            })
          : baseTriggersConfig,
        ...(options?.default && { default: options.default }),
      },
    }),
  );
  vi.mocked(api.getConditionStateManager().getState).mockReturnValue({});
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
  vi.mocked(api.getCameraManager().getStore).mockReturnValue(
    createStore([
      {
        cameraID: 'camera_1',
        config: createCameraConfig({
          triggers: {
            entities: ['binary_sensor.motion'],
          },
        }),
      },
    ]),
  );
  vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(
    options?.interaction ?? false,
  );
  vi.mocked(api.getViewManager().getView).mockReturnValue(
    createView({
      camera: 'camera_1' as const,
    }),
  );

  return api;
};

// @vitest-environment jsdom
describe('TriggersManager', () => {
  const start = new Date('2023-10-01T17:14');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });

  it('should not be triggered by default', () => {
    const manager = new TriggersManager(createCardAPI());
    expect(manager.isTriggered()).toBeFalsy();
  });

  it('should not trigger if triggers config is empty', async () => {
    const api = createTriggerAPI({
      config: {
        actions: {
          trigger: 'none',
        },
      },
    });
    const manager = new TriggersManager(api);

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
  });

  it('should not trigger if there is no config', async () => {
    const api = createTriggerAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

    const manager = new TriggersManager(api);

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeFalsy();
  });

  describe('trigger actions', () => {
    it('should handle trigger action set to update', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'update',
          },
        },
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
        queryExecutorOptions: { useCache: false },
      });
    });

    it('should handle trigger action set to default', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'default',
          },
        },
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalledWith({
        params: {
          camera: 'camera_1',
        },
      });
    });

    it('should handle trigger action set to live', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'live',
          },
        },
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
        params: {
          view: 'live',
          camera: 'camera_1',
        },
      });
    });

    describe('media', () => {
      it.each([
        [false, false, null],
        [false, true, 'clip' as const],
        [true, false, 'snapshot' as const],
        [true, true, 'clip' as const],
      ])(
        'with snapshot %s and clip %s',
        async (
          hasSnapshot: boolean,
          hasClip: boolean,
          viewName: 'clip' | 'snapshot' | null,
        ) => {
          const api = createTriggerAPI({
            config: {
              actions: {
                interaction_mode: 'all',
                trigger: 'media',
                untrigger: 'none',
              },
            },
          });
          const manager = new TriggersManager(api);

          await manager.handleCameraEvent({
            cameraID: 'camera_1',
            id: 'event-1',
            type: 'new',
            fidelity: 'high',
            snapshot: hasSnapshot,
            clip: hasClip,
          });

          if (!viewName) {
            expect(
              api.getViewManager().setViewByParametersWithNewQuery,
            ).not.toBeCalled();
          } else {
            expect(manager.isTriggered()).toBeTruthy();
            expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
              params: {
                camera: 'camera_1',
                view: viewName,
              },
            });
          }
        },
      );
    });

    it('should handle trigger action set to none', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'none',
          },
        },
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });
  });

  describe('untrigger actions', () => {
    it('should handle untrigger action set to none with no trigger actions', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'none',
            untrigger: 'none',
          },
        },
      });

      const manager = new TriggersManager(api);
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'end',
      });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      expect(manager.isTriggered()).toBeFalsy();

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });

    it('should handle untrigger action set to default', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'none',
            untrigger: 'default',
          },
        },
      });

      const manager = new TriggersManager(api);
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'end',
      });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      expect(manager.isTriggered()).toBeFalsy();

      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
    });

    it('should handle untrigger call with no state', async () => {
      const api = createTriggerAPI();
      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'unknown-id',
        type: 'end',
      });

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    });

    it('should not untrigger if other sources are still active', async () => {
      const api = createTriggerAPI();
      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_1',
        type: 'new',
      });
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_2',
        type: 'new',
      });

      expect(manager.isTriggered()).toBeTruthy();

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_1',
        type: 'end',
      });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      // Should still be triggered because entity_2 is active.
      expect(manager.isTriggered()).toBeTruthy();

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_2',
        type: 'end',
      });

      vi.setSystemTime(add(start, { seconds: 20 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      expect(manager.isTriggered()).toBeFalsy();
    });

    it('should cancel untrigger timer if a new trigger starts', async () => {
      const api = createTriggerAPI();
      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_1',
        type: 'new',
      });
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_1',
        type: 'end',
      });

      // Move time forward by 5s (the untrigger delay is 10s).
      vi.setSystemTime(add(start, { seconds: 5 }));

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'entity_1',
        type: 'new',
      });

      vi.setSystemTime(add(start, { seconds: 15 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      // Should still be triggered because the second 'new' event should have cancelled the first timer.
      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    });

    it('should untrigger each camera independently', async () => {
      const api = createTriggerAPI();
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_1',
            config: createCameraConfig({
              triggers: { entities: ['binary_sensor.motion_1'] },
            }),
          },
          {
            cameraID: 'camera_2',
            config: createCameraConfig({
              triggers: { entities: ['binary_sensor.motion_2'] },
            }),
          },
        ]),
      );

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        type: 'new',
        id: 'motion_1',
      });
      await manager.handleCameraEvent({
        cameraID: 'camera_2',
        type: 'new',
        id: 'motion_2',
      });

      expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_1', 'camera_2']));

      // Untrigger camera 1.
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        type: 'end',
        id: 'motion_1',
      });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      // Camera 1 untriggered: setViewDefaultWithNewQuery is called.
      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalledTimes(1);
      // Camera 2 is still triggered.
      expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_2']));

      // Untrigger camera 2.
      await manager.handleCameraEvent({
        cameraID: 'camera_2',
        type: 'end',
        id: 'motion_2',
      });

      vi.setSystemTime(add(start, { seconds: 20 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      // Camera 2 untriggered: setViewDefaultWithNewQuery is called again.
      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalledTimes(2);
      expect(manager.getTriggeredCameraIDs()).toEqual(new Set());
    });

    it('should untrigger immediately when untrigger_seconds is 0', async () => {
      const api = createTriggerAPI({
        config: {
          untrigger_seconds: 0,
        },
      });
      const manager = new TriggersManager(api);
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });
      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'end',
      });
      await flushPromises();

      expect(manager.isTriggered()).toBeFalsy();
      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
    });
  });

  describe('condition state management', () => {
    it('should manage condition state', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'none',
            untrigger: 'none',
          },
        },
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });

      expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
        triggered: new Set(['camera_1']),
      });
      vi.mocked(api.getConditionStateManager().getState).mockReturnValue({
        triggered: new Set(['camera_1']),
      });

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'end',
      });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
        triggered: undefined,
      });
    });
  });

  describe('should take no actions with high-fidelity event', () => {
    it('should ignore high-fidelity events when trigger action is not live', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'media',
          },
        },
        default: 'live',
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
        fidelity: 'high',
      });

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });

    it('should ignore high-fidelity events when default view is not live', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          actions: {
            ...baseTriggersConfig.actions,
            trigger: 'default',
          },
        },
        default: 'clips',
      });

      const manager = new TriggersManager(api);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
        fidelity: 'high',
      });

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });
  });

  it('should take no actions with human interactions', async () => {
    const api = createTriggerAPI({
      // Interaction present.
      interaction: true,
    });
    const manager = new TriggersManager(api);

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeTruthy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
  });

  it('should take no actions when actions are set to none', async () => {
    const api = createTriggerAPI({
      config: {
        actions: {
          interaction_mode: 'all',
          trigger: 'none',
          untrigger: 'none',
        },
      },
    });
    const manager = new TriggersManager(api);
    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });
    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();
    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
  });

  it('should take actions with human interactions when interaction mode is active', async () => {
    const api = createTriggerAPI({
      // Interaction present.
      interaction: true,
      config: {
        ...baseTriggersConfig,
        actions: {
          trigger: 'live' as const,
          untrigger: 'default' as const,
          interaction_mode: 'active',
        },
      },
    });
    const manager = new TriggersManager(api);
    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
      params: {
        view: 'live' as const,
        camera: 'camera_1' as const,
      },
    });

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();
    await flushPromises();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
  });

  it('should report multiple triggered cameras', async () => {
    const api = createTriggerAPI();
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera_1',
          config: createCameraConfig({
            triggers: {
              entities: ['binary_sensor.one'],
            },
          }),
        },
        {
          cameraID: 'camera_2',
          config: createCameraConfig({
            triggers: {
              entities: ['binary_sensor.two'],
            },
          }),
        },
      ]),
    );

    const manager = new TriggersManager(api);

    expect(manager.isTriggered()).toBeFalsy();
    expect(manager.getMostRecentlyTriggeredCameraID()).toBeNull();
    expect(manager.getTriggeredCameraIDs()).toEqual(new Set());

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });
    await manager.handleCameraEvent({
      cameraID: 'camera_2',
      id: 'event-2',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeTruthy();
    expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_1', 'camera_2']));

    // Either is the most recently triggered.
    expect(['camera_1', 'camera_2']).toContain(
      manager.getMostRecentlyTriggeredCameraID(),
    );

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    await flushPromises();

    expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_2']));
    expect(manager.getMostRecentlyTriggeredCameraID()).toBe('camera_2');
  });

  describe('should filter triggers by camera', () => {
    it('should filter triggers when there are no dependencies', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          // Filter triggers to selected camera only.
          filter_selected_camera: true,
        },
      });
      const manager = new TriggersManager(api);
      expect(manager.isTriggered()).toBeFalsy();

      const otherCameraSelected = createView({
        camera: 'camera_SOME_OTHER_CAMERA' as const,
      });
      vi.mocked(api.getViewManager().getView).mockReturnValue(otherCameraSelected);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });
      expect(manager.isTriggered()).toBeFalsy();

      const thisCameraSelected = createView({
        camera: 'camera_1' as const,
      });
      vi.mocked(api.getViewManager().getView).mockReturnValue(thisCameraSelected);

      await manager.handleCameraEvent({
        cameraID: 'camera_1',
        id: 'event-1',
        type: 'new',
      });
      expect(manager.isTriggered()).toBeTruthy();
    });

    it('should not filter triggers when there are dependencies', async () => {
      const api = createTriggerAPI({
        config: {
          ...baseTriggersConfig,
          // Filter triggers to selected camera only.
          filter_selected_camera: true,
        },
      });
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_primary',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion'],
              },
              dependencies: {
                all_cameras: true,
              },
            }),
          },
          {
            cameraID: 'camera_secondary',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion'],
              },
            }),
          },
        ]),
      );

      const manager = new TriggersManager(api);

      const primaryCameraView = createView({
        camera: 'camera_primary' as const,
      });
      vi.mocked(api.getViewManager().getView).mockReturnValue(primaryCameraView);

      // Events for the secondary will still trigger when filter_selected_camera
      // is true.
      await manager.handleCameraEvent({
        cameraID: 'camera_secondary',
        id: 'event-secondary',
        type: 'new',
      });
      expect(manager.isTriggered()).toBeTruthy();
    });
  });

  describe('should handle initial camera triggers', () => {
    it('should not trigger if no cameras have trigger entities', async () => {
      const api = createTriggerAPI();
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_1',
            config: createCameraConfig({
              triggers: {
                entities: [],
              },
            }),
          },
        ]),
      );

      const manager = new TriggersManager(api);
      const result = await manager.handleInitialCameraTriggers();

      expect(result).toBeFalsy();
      expect(manager.isTriggered()).toBeFalsy();
    });

    it('should not trigger if no cameras have trigger state', async () => {
      const api = createTriggerAPI();
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_1',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion', 'binary_sensor.occupancy'],
              },
            }),
          },
        ]),
      );

      const hass = createHASS({
        'binary_sensor.motion': createStateEntity({
          state: 'off',
        }),
        'binary_sensor.occupancy': createStateEntity({
          state: 'off',
        }),
      });
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new TriggersManager(api);
      const result = await manager.handleInitialCameraTriggers();

      expect(result).toBeFalsy();
      expect(manager.isTriggered()).toBeFalsy();
    });

    it('should trigger if cameras are triggered', async () => {
      const api = createTriggerAPI();
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_1',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion', 'binary_sensor.occupancy'],
              },
            }),
          },
        ]),
      );

      const hass = createHASS({
        'binary_sensor.motion': createStateEntity({
          state: 'off',
        }),
        'binary_sensor.occupancy': createStateEntity({
          state: 'on',
        }),
      });
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new TriggersManager(api);
      const result = await manager.handleInitialCameraTriggers();

      expect(result).toBeTruthy();
      expect(manager.isTriggered()).toBeTruthy();
    });

    it('should only execute a single trigger action at startup for multiple triggered sources', async () => {
      const api = createTriggerAPI();
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_1',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion', 'binary_sensor.occupancy'],
              },
            }),
          },
        ]),
      );

      const hass = createHASS({
        'binary_sensor.motion': createStateEntity({
          state: 'on',
        }),
        'binary_sensor.occupancy': createStateEntity({
          state: 'open',
        }),
      });
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new TriggersManager(api);
      const result = await manager.handleInitialCameraTriggers();

      expect(result).toBeTruthy();
      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledTimes(1);
    });

    it('should prioritize the first triggered camera action at startup', async () => {
      const api = createTriggerAPI({
        config: {
          actions: {
            trigger: 'live',
          },
        },
      });
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_1',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion_1'],
              },
            }),
          },
          {
            cameraID: 'camera_2',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion_2'],
              },
            }),
          },
        ]),
      );

      const hass = createHASS({
        'binary_sensor.motion_1': createStateEntity({
          state: 'on',
        }),
        'binary_sensor.motion_2': createStateEntity({
          state: 'on',
        }),
      });
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new TriggersManager(api);
      const result = await manager.handleInitialCameraTriggers();

      expect(result).toBeTruthy();
      expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_1', 'camera_2']));
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledTimes(1);
      expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
        params: {
          view: 'live',
          camera: 'camera_1',
        },
      });
    });

    it('should not execute startup action if triggered cameras are filtered out', async () => {
      const api = createTriggerAPI({
        config: {
          filter_selected_camera: true,
        },
      });
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera_2',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion_2'],
              },
            }),
          },
        ]),
      );

      const hass = createHASS({
        'binary_sensor.motion_2': createStateEntity({
          state: 'on',
        }),
      });
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new TriggersManager(api);
      const result = await manager.handleInitialCameraTriggers();

      // A trigger entity was active...
      expect(result).toBeTruthy();
      // ...but the camera was filtered out, so no trigger state/action was applied.
      expect(manager.isTriggered()).toBeFalsy();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    });
  });

  it('should take actions with human interactions when interaction mode is active', async () => {
    const api = createTriggerAPI({
      // Interaction present.
      interaction: true,
      config: {
        ...baseTriggersConfig,
        actions: {
          trigger: 'live' as const,
          untrigger: 'default' as const,
          interaction_mode: 'active',
        },
      },
    });
    const manager = new TriggersManager(api);
    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
      params: {
        view: 'live' as const,
        camera: 'camera_1' as const,
      },
    });

    await manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'event-1',
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();
    await flushPromises();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
  });

  it('should ignore untrigger actions during non-allowable interaction but still untrigger camera', async () => {
    const api = createTriggerAPI({
      interaction: true,
      config: {
        actions: {
          interaction_mode: 'inactive',
          untrigger: 'default',
        },
      },
    });
    const manager = new TriggersManager(api);

    await manager.handleCameraEvent({ cameraID: 'camera_1', id: 'e1', type: 'new' });
    await manager.handleCameraEvent({ cameraID: 'camera_1', id: 'e1', type: 'end' });

    vi.setSystemTime(add(start, { seconds: 15 }));
    vi.runOnlyPendingTimers();
    await flushPromises();

    // Camera is untriggered...
    expect(manager.isTriggered()).toBe(false);

    // ...but the action was skipped.
    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toHaveBeenCalled();
  });

  it('should not include cameras with no active sources in triggered IDs even before untrigger action completes', async () => {
    const api = createTriggerAPI({
      config: {
        untrigger_seconds: 0,
      },
    });
    const manager = new TriggersManager(api);

    // Trigger then end, but don't await the end event so we can check
    // triggered IDs while the camera is in the map but no longer triggered.
    await manager.handleCameraEvent({ cameraID: 'camera_1', id: 'e1', type: 'new' });
    const untriggerPromise = manager.handleCameraEvent({
      cameraID: 'camera_1',
      id: 'e1',
      type: 'end',
    });

    expect(manager.getTriggeredCameraIDs()).toEqual(new Set());

    await untriggerPromise;
  });

  it('should handle newly missing configuration', async () => {
    const api = createTriggerAPI();
    const manager = new TriggersManager(api);

    // 1. Trigger the camera with valid config.
    await manager.handleCameraEvent({ cameraID: 'camera_1', id: 'e1', type: 'new' });

    // 2. Mock getConfig to return null.
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

    // 3. End the trigger. This should now hit the fallback '?? 0' in
    //    _startUntrigger because getConfig() is null.
    await manager.handleCameraEvent({ cameraID: 'camera_1', id: 'e1', type: 'end' });

    // Should NOT have triggered a view reset (since config is missing, no
    // untrigger action is defined).
    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toHaveBeenCalled();

    // But the camera should be untriggered.
    expect(manager.isTriggered()).toBe(false);
  });
});
