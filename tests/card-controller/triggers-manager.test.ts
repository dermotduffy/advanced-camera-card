import { add } from 'date-fns';
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

// Creating and mocking a trigger API is a lot of boilerplate, this convenience
// function reduces it.
const createTriggerAPI = (options?: {
  config?: Partial<TriggersOptions>;
  default?: AdvancedCameraCardView;
  interaction?: boolean;
}): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({
      view: {
        triggers: options?.config
          ? triggersSchema.parse(options.config)
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

  it('should not trigger without a triggers config', () => {
    const api = createTriggerAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        camera: 'camera_1' as const,
      }),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

    const manager = new TriggersManager(api);

    manager.handleCameraEvent({
      cameraID: 'camera_1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeFalsy();
  });

  describe('trigger actions', () => {
    it('update', async () => {
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
        type: 'new',
      });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith({
        queryExecutorOptions: { useCache: false },
      });
    });

    it('default', async () => {
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

      await manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new' });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalledWith({
        params: {
          camera: 'camera_1',
        },
      });
    });

    it('live', () => {
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

      manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new' });

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

          manager.handleCameraEvent({
            cameraID: 'camera_1',
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

    it('none', () => {
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

      manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new' });

      expect(manager.isTriggered()).toBeTruthy();
      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });
  });

  describe('untrigger actions', () => {
    it('none', () => {
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
      manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new' });
      manager.handleCameraEvent({ cameraID: 'camera_1', type: 'end' });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();

      expect(manager.isTriggered()).toBeFalsy();

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });

    it('default', async () => {
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
      await manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new' });
      await manager.handleCameraEvent({ cameraID: 'camera_1', type: 'end' });

      vi.setSystemTime(add(start, { seconds: 10 }));
      vi.runOnlyPendingTimers();
      await flushPromises();

      expect(manager.isTriggered()).toBeFalsy();

      expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
    });
  });

  it('should manage condition state', () => {
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

    manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new' });

    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      triggered: new Set(['camera_1']),
    });
    vi.mocked(api.getConditionStateManager().getState).mockReturnValue({
      triggered: new Set(['camera_1']),
    });

    manager.handleCameraEvent({ cameraID: 'camera_1', type: 'end' });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith({
      triggered: undefined,
    });
  });

  describe('should take no actions with high-fidelity event', () => {
    it('with non-live action', () => {
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

      manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new', fidelity: 'high' });

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });

    it('with non-live default', () => {
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

      manager.handleCameraEvent({ cameraID: 'camera_1', type: 'new', fidelity: 'high' });

      expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
      expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
    });
  });

  it('should take no actions with human interactions', () => {
    const api = createTriggerAPI({
      // Interaction present.
      interaction: true,
    });
    const manager = new TriggersManager(api);

    manager.handleCameraEvent({
      cameraID: 'camera_1',
      type: 'new',
    });

    expect(manager.isTriggered()).toBeTruthy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();

    manager.handleCameraEvent({
      cameraID: 'camera_1',
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
  });

  it('should take no actions when actions are set to none', () => {
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
    manager.handleCameraEvent({
      cameraID: 'camera_1',
      type: 'new',
    });
    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewDefaultWithNewQuery).not.toBeCalled();
    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();

    manager.handleCameraEvent({
      cameraID: 'camera_1',
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
      type: 'new',
    });
    await manager.handleCameraEvent({
      cameraID: 'camera_2',
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
      type: 'end',
    });

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    await flushPromises();

    expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_2']));
    expect(manager.getMostRecentlyTriggeredCameraID()).toBe('camera_2');
  });

  describe('should filter triggers by camera', () => {
    it('no dependencies', () => {
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

      manager.handleCameraEvent({
        cameraID: 'camera_1',
        type: 'new',
      });
      expect(manager.isTriggered()).toBeFalsy();

      const thisCameraSelected = createView({
        camera: 'camera_1' as const,
      });
      vi.mocked(api.getViewManager().getView).mockReturnValue(thisCameraSelected);

      manager.handleCameraEvent({
        cameraID: 'camera_1',
        type: 'new',
      });
      expect(manager.isTriggered()).toBeTruthy();
    });

    it('dependencies', () => {
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
      manager.handleCameraEvent({
        cameraID: 'camera_secondary',
        type: 'new',
      });
      expect(manager.isTriggered()).toBeTruthy();
    });
  });
});
