import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera.js';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic.js';
import type { CameraProxyConfig } from '../../src/camera-manager/types.js';
import type { EventWatcherSubscriptionInterface } from '../../src/card-controller/hass/event-watcher.js';
import type { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher.js';
import type { EntityRegistryManager } from '../../src/ha/registry/entity/types.js';
import type * as LiveProviderUtils from '../../src/utils/live-provider.js';
import { liveProviderSupports2WayAudio } from '../../src/utils/live-provider.js';
import { createCameraConfig } from '../config/test-utils';
import { EntityRegistryManagerMock } from '../ha/registry/entity/mock.js';
import {
  callEventWatcherCallback,
  callStateWatcherCallback,
  createHASS,
  createHASSEvent,
  createHASSManager,
  createRegistryEntity,
  createStateEntity,
} from '../test-utils.js';
import {
  createCapabilities,
  createInitializedCamera,
  createSubscribedCamera,
  TestCamera,
} from './test-utils';

// Partially mock to keep the real pure helpers (e.g. `isGo2RTCLiveProvider`
// used by `getProxyConfig`) while mocking the async metadata fetch.
vi.mock('../../src/utils/live-provider.js', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveProviderUtils>()),
  liveProviderSupports2WayAudio: vi.fn(),
}));

describe('Camera', () => {
  it('should get config', async () => {
    const config = createCameraConfig();
    const camera = new Camera(
      config,
      new GenericCameraManagerEngine(createHASSManager()),
      { hassManager: createHASSManager() },
    );
    expect(camera.getConfig()).toBe(config);
  });

  describe('should get capabilities', async () => {
    it('should return the capabilities it was constructed with', async () => {
      const capabilities = createCapabilities();
      const camera = await createInitializedCamera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        capabilities,
      );
      expect(camera.getCapabilities()).toBe(capabilities);
    });

    it('should return provisional capabilities derived from configuration alone', async () => {
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities().getRawCapabilities()).toEqual({
        live: true,
        menu: true,
        substream: true,
        trigger: true,
        'remote-control-entity': true,
      });
    });
  });

  describe('should get provisional capabilities', () => {
    it('should include configured PTZ actions', () => {
      const camera = new Camera(
        createCameraConfig({
          ptz: {
            presets: {
              window: {
                action: 'perform-action' as const,
                perform_action: 'action',
              },
            },
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities().getPTZCapabilities()?.presets).toEqual(['window']);
    });

    it('should claim a forced capability', () => {
      const camera = new Camera(
        createCameraConfig({ capabilities: { force: ['2-way-audio'] } }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities().has('2-way-audio')).toBe(true);
    });

    it('should not claim a forced capability that is also disabled', () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: { force: ['2-way-audio'], disable: ['2-way-audio'] },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities().has('2-way-audio')).toBe(false);
    });

    it('should not claim disabled capabilities', () => {
      const camera = new Camera(
        createCameraConfig({ capabilities: { disable: ['live'] } }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities().has('live')).toBe(false);
      expect(camera.getCapabilities().has('menu')).toBe(true);
    });

    it('should only claim excepted capabilities when disable_except is set', () => {
      const camera = new Camera(
        createCameraConfig({ capabilities: { disable_except: ['menu'] } }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities().has('menu')).toBe(true);
      expect(camera.getCapabilities().has('live')).toBe(false);
    });

    it('should return the same provisional object across calls', () => {
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getCapabilities()).toBe(camera.getCapabilities());
    });

    it('should prefer resolved capabilities once initialized', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      const provisional = camera.getCapabilities();
      expect(provisional.has('2-way-audio')).toBe(false);

      await camera.initialize();

      const resolved = camera.getCapabilities();
      expect(resolved).not.toBe(provisional);
      expect(resolved.has('2-way-audio')).toBe(true);
    });
  });

  it('should get engine', async () => {
    const engine = new GenericCameraManagerEngine(createHASSManager());
    const camera = new Camera(createCameraConfig(), engine, {
      hassManager: createHASSManager(),
    });
    expect(camera.getEngine()).toBe(engine);
  });

  it('should set and get id', async () => {
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(createHASSManager()),
      { hassManager: createHASSManager() },
    );
    camera.setID('foo');
    expect(camera.getID()).toBe('foo');
  });

  it('should throw without id', async () => {
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(createHASSManager()),
      { hassManager: createHASSManager() },
    );
    expect(() => camera.getID()).toThrow(
      'Could not determine camera id for the following ' +
        "camera, may need to set 'id' parameter manually",
    );
  });

  describe('initialize', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize without registering subscriptions', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ stateWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: true }));
      expect(camera.isInitialized()).toBe(false);

      await camera.initialize();

      expect(camera.isInitialized()).toBe(true);
      expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    });

    it('should register no subscriptions when initialization fails', async () => {
      const error = new Error('registry failed');
      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockRejectedValue(error);

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          camera_entity: 'camera.foo',
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        {
          hassManager: createHASSManager({ stateWatcher }),
          entityRegistryManager,
        },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await expect(camera.initialize()).rejects.toThrow(error);

      expect(camera.isInitialized()).toBe(false);
      camera.subscribe();
      expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    });

    it('should skip initialization when hass is unavailable', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new Camera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ hass: null, stateWatcher }) },
      );

      await camera.initialize();

      // Initialization never ran, so only the provisional capabilities are
      // available.
      expect(camera.getCapabilities().has('live')).toBe(true);
      expect(camera.getCapabilities().has('2-way-audio')).toBe(false);
      expect(camera.isInitialized()).toBe(false);

      camera.subscribe();
      expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    });

    it('should set capabilities and use go2rtc metadata endpoint', async () => {
      const camera = new Camera(
        createCameraConfig({
          go2rtc: {
            url: 'http://go2rtc',
            stream: 'stream',
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        2,
        {
          endpoint: 'http://go2rtc/api/streams?src=stream&video=all&audio=all',
          sign: false,
        },
        expect.objectContaining({
          dynamic: true,
          ssl_verification: true,
          ssl_ciphers: 'default',
          enabled: false,
        }),
      );

      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(true);
    });

    it('should set capabilities when go2rtc metadata endpoint fails', async () => {
      const camera = new Camera(
        createCameraConfig({
          go2rtc: {
            url: 'http://go2rtc',
            stream: 'stream',
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(false);

      await camera.initialize();

      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(false);
    });

    it('should pass camera go2rtc metadata timeout', async () => {
      const camera = new Camera(
        createCameraConfig({
          go2rtc: {
            url: 'http://go2rtc',
            stream: 'stream',
            metadata_fetch_timeout_seconds: 20,
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        20,
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });

    it('should pass proxy config when web proxy is available', async () => {
      const hass = createHASS();
      hass.config.components = ['hass_web_proxy'];

      const camera = new Camera(
        createCameraConfig({
          go2rtc: {
            url: 'http://go2rtc',
            stream: 'stream',
          },
          proxy: {
            live: true,
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ hass }) },
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        2,
        expect.anything(),
        {
          dynamic: true,
          ssl_verification: true,
          ssl_ciphers: 'default',
          live: true,
          media: false,
          enabled: true,
          enforce: true,
        },
      );

      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(true);
    });

    it('should return live proxy config', () => {
      const camera = new Camera(
        createCameraConfig({
          proxy: { live: true },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getLiveProxyConfig()).toEqual(
        expect.objectContaining({ enabled: true, enforce: true }),
      );
    });

    it('should return media proxy config', () => {
      const camera = new Camera(
        createCameraConfig({
          proxy: { media: true },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getMediaProxyConfig()).toEqual(
        expect.objectContaining({ enabled: true, enforce: true }),
      );
    });

    it('should not enforce live proxy config when live proxying is auto', () => {
      const camera = new Camera(
        createCameraConfig({
          live_provider: 'go2rtc',
          go2rtc: { url: 'http://go2rtc' },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getLiveProxyConfig()).toEqual(
        expect.objectContaining({ enabled: true, enforce: false }),
      );
    });

    it('should not enforce media proxy config when media proxying is auto', () => {
      const camera = new Camera(
        createCameraConfig({
          proxy: { media: 'auto' },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getMediaProxyConfig()).toEqual(
        expect.objectContaining({ enabled: false, enforce: false }),
      );
    });

    it('should force 2-way-audio capability true without metadata fetch', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            force: ['2-way-audio'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).not.toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(true);
    });

    it('should prefer disable over force rules', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            disable: ['2-way-audio'],
            force: ['2-way-audio'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).not.toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(false);
    });

    it('should prefer disable_except over force rules', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            disable_except: ['substream'],
            force: ['2-way-audio'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).not.toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(false);
    });

    it('should not fetch metadata when 2-way-audio is disabled', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            disable: ['2-way-audio'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).not.toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(false);
    });

    it('should not fetch metadata when disable_except excludes 2-way-audio', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            disable_except: ['substream'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).not.toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(false);
    });

    it('should fetch metadata when disable_except includes 2-way-audio', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            disable_except: ['substream', '2-way-audio'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(true);
    });

    it('should fetch metadata when disable_except is empty', async () => {
      const camera = new Camera(
        createCameraConfig({
          capabilities: {
            disable_except: [],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize();

      expect(liveProviderSupports2WayAudio).toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(true);
    });

    describe('entity resolution', () => {
      it('should resolve entity when camera_entity and registry manager are provided', async () => {
        const cameraEntity = createRegistryEntity({
          entity_id: 'camera.front_door',
          device_id: 'device_1',
        });
        const camera = new Camera(
          createCameraConfig({ camera_entity: 'camera.front_door' }),
          new GenericCameraManagerEngine(createHASSManager()),
          {
            hassManager: createHASSManager(),
            entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
          },
        );

        await camera.initialize();

        expect(camera.getEntity()).toEqual(cameraEntity);
      });

      it('should leave entity null when camera_entity is unset', async () => {
        const camera = new Camera(
          createCameraConfig(),
          new GenericCameraManagerEngine(createHASSManager()),
          {
            hassManager: createHASSManager(),
            entityRegistryManager: new EntityRegistryManagerMock(),
          },
        );

        await camera.initialize();

        expect(camera.getEntity()).toBeNull();
      });

      it('should leave entity null when entityRegistryManager is not provided', async () => {
        const camera = new Camera(
          createCameraConfig({ camera_entity: 'camera.front_door' }),
          new GenericCameraManagerEngine(createHASSManager()),
          { hassManager: createHASSManager() },
        );

        await camera.initialize();

        expect(camera.getEntity()).toBeNull();
      });
    });

    describe('trigger discovery', () => {
      describe('doorbell', () => {
        const initializeDoorbellCamera = async (options?: {
          doorbell?: boolean;
          deviceID?: string | null;
          triggerCapability?: boolean;
          userEntities?: string[];
          omitRegistryManager?: boolean;
          registryEntities?: ReturnType<typeof createRegistryEntity>[];
          stateEntities?: Parameters<typeof createHASS>[0];
        }): Promise<{
          camera: Camera;
          stateWatcher: StateWatcherSubscriptionInterface;
        }> => {
          const cameraEntity = createRegistryEntity({
            entity_id: 'camera.front_door',
            device_id: options?.deviceID === undefined ? 'device_1' : options.deviceID,
          });
          const doorbellEntity = createRegistryEntity({
            entity_id: 'event.front_door_doorbell',
            device_id: 'device_1',
          });
          const stateWatcher = mock<StateWatcherSubscriptionInterface>();
          const hass = createHASS(
            options?.stateEntities ?? {
              'event.front_door_doorbell': createStateEntity({
                entity_id: 'event.front_door_doorbell',
                attributes: { device_class: 'doorbell' },
              }),
            },
          );
          const camera = new TestCamera(
            createCameraConfig({
              camera_entity: 'camera.front_door',
              triggers: {
                doorbell: options?.doorbell ?? true,
                ...(options?.userEntities && { entities: options.userEntities }),
              },
            }),
            new GenericCameraManagerEngine(createHASSManager()),
            {
              hassManager: createHASSManager({ hass, stateWatcher }),
              ...(!options?.omitRegistryManager && {
                entityRegistryManager: new EntityRegistryManagerMock(
                  options?.registryEntities ?? [cameraEntity, doorbellEntity],
                ),
              }),
            },
          ).setCapabilities(
            createCapabilities({ trigger: options?.triggerCapability ?? true }),
          );
          await camera.initialize();
          return { camera, stateWatcher };
        };

        it('should auto-include doorbell event entity from camera device', async () => {
          const { camera } = await initializeDoorbellCamera();
          expect(camera.getTriggerEntities()).toEqual(['event.front_door_doorbell']);
        });

        it('should skip discovery when triggers.doorbell is false', async () => {
          const { camera } = await initializeDoorbellCamera({ doorbell: false });
          expect(camera.getTriggerEntities()).toEqual([]);
        });

        it('should skip discovery when camera entity has no device_id', async () => {
          const { camera } = await initializeDoorbellCamera({ deviceID: null });
          expect(camera.getTriggerEntities()).toEqual([]);
        });

        it('should skip discovery when trigger capability is disabled', async () => {
          const { camera } = await initializeDoorbellCamera({
            triggerCapability: false,
          });
          expect(camera.getTriggerEntities()).toEqual([]);
        });

        it('should skip discovery when entityRegistryManager is not provided', async () => {
          const { camera } = await initializeDoorbellCamera({
            omitRegistryManager: true,
          });
          expect(camera.getTriggerEntities()).toEqual([]);
        });

        it('should de-duplicate against user-supplied entities', async () => {
          const { camera } = await initializeDoorbellCamera({
            userEntities: ['event.front_door_doorbell', 'binary_sensor.driveway'],
          });
          expect(camera.getTriggerEntities()).toEqual([
            'event.front_door_doorbell',
            'binary_sensor.driveway',
          ]);
        });

        it('should skip disabled event entities', async () => {
          const { camera } = await initializeDoorbellCamera({
            registryEntities: [
              createRegistryEntity({
                entity_id: 'camera.front_door',
                device_id: 'device_1',
              }),
              createRegistryEntity({
                entity_id: 'event.front_door_doorbell',
                device_id: 'device_1',
                disabled_by: 'user',
              }),
            ],
          });
          expect(camera.getTriggerEntities()).toEqual([]);
        });

        it('should ignore non-doorbell event entities on the device', async () => {
          const { camera } = await initializeDoorbellCamera({
            registryEntities: [
              createRegistryEntity({
                entity_id: 'camera.front_door',
                device_id: 'device_1',
              }),
              createRegistryEntity({
                entity_id: 'event.front_door_button',
                device_id: 'device_1',
              }),
            ],
            stateEntities: {
              'event.front_door_button': createStateEntity({
                entity_id: 'event.front_door_button',
                attributes: { device_class: 'button' },
              }),
            },
          });
          expect(camera.getTriggerEntities()).toEqual([]);
        });

        it('should subscribe to discovered doorbell entities when subscribed', async () => {
          const { camera, stateWatcher } = await initializeDoorbellCamera();
          camera.subscribe();
          expect(stateWatcher.subscribe).toHaveBeenCalledWith(expect.any(Function), [
            'event.front_door_doorbell',
          ]);
        });
      });
    });
  });

  describe('subscribe', () => {
    it('should register state subscriptions when subscribing', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = await createInitializedCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        createCapabilities({ trigger: true }),
        stateWatcher,
      );

      camera.subscribe();

      expect(stateWatcher.subscribe).toHaveBeenCalledWith(expect.any(Function), [
        'camera.foo',
      ]);
    });

    it('should not register subscriptions again when subscribed twice', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = await createSubscribedCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        createCapabilities({ trigger: true }),
        stateWatcher,
      );

      camera.subscribe();

      expect(stateWatcher.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should not register subscriptions before initialization', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ stateWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: true }));

      camera.subscribe();

      expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    });

    it('should release earlier subscriptions when a later subscription throws', async () => {
      const error = new Error('subscribe failed');
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      vi.mocked(eventWatcher.subscribe)
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw error;
        });

      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['binary_sensor.foo'],
            events: [{ event_type: ['zha_event', 'deconz_event'] }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ stateWatcher, eventWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: true }));
      await camera.initialize();

      expect(() => camera.subscribe()).toThrow(error);

      // The state subscription and the first event subscription registered
      // before the failure, so subscribe itself must release them.
      expect(stateWatcher.unsubscribe).toHaveBeenCalled();
      expect(eventWatcher.unsubscribe).toHaveBeenCalledTimes(1);
      expect(eventWatcher.unsubscribe).toHaveBeenCalledWith(
        vi.mocked(eventWatcher.subscribe).mock.calls[0][0],
      );
    });
  });

  describe('unsubscribe', () => {
    it('should release subscriptions without resetting initialization', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = await createSubscribedCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        createCapabilities({ trigger: true }),
        stateWatcher,
      );

      camera.unsubscribe();

      expect(stateWatcher.unsubscribe).toHaveBeenCalledTimes(1);
      expect(camera.isInitialized()).toBe(true);
    });

    it('should not release subscriptions again when unsubscribed twice', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = await createSubscribedCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        createCapabilities({ trigger: true }),
        stateWatcher,
      );

      camera.unsubscribe();
      camera.unsubscribe();

      expect(stateWatcher.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should release nothing when never subscribed', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = await createInitializedCamera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        createCapabilities({ trigger: true }),
        stateWatcher,
      );

      camera.unsubscribe();

      expect(stateWatcher.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('should handle trigger state changes', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it.each([
      ['off' as const, 'on' as const, 'new' as const],
      ['on' as const, 'off' as const, 'end' as const],
    ])(
      'from %s to %s',
      async (stateFrom: string, stateTo: string, eventType: 'new' | 'end') => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const eventCallback = vi.fn();
        const stateWatcher = mock<StateWatcherSubscriptionInterface>();
        const camera = new TestCamera(
          createCameraConfig({
            id: 'camera_1',
            triggers: {
              entities: ['binary_sensor.foo'],
            },
          }),
          new GenericCameraManagerEngine(createHASSManager()),
          { hassManager: createHASSManager({ stateWatcher }) },
          { eventCallback: eventCallback },
        ).setCapabilities(createCapabilities({ trigger: true }));

        await camera.initialize();
        camera.subscribe();

        expect(stateWatcher.subscribe).toHaveBeenCalled();

        const diff = {
          entityID: 'sensor.force_update',
          oldState: createStateEntity({ state: stateFrom }),
          newState: createStateEntity({ state: stateTo }),
        };
        callStateWatcherCallback(stateWatcher, diff);

        expect(eventCallback).toHaveBeenCalledWith({
          cameraID: 'camera_1',
          id: 'sensor.force_update',
          type: eventType,
        });
      },
    );

    it('should subscribe to configured triggers.events and dispatch momentary events', async () => {
      const eventCallback = vi.fn();
      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event' }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ eventWatcher }) },
        { eventCallback },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await camera.initialize();
      expect(eventWatcher.subscribe).not.toHaveBeenCalled();

      camera.subscribe();

      expect(eventWatcher.subscribe).toHaveBeenCalledTimes(1);
      const request = vi.mocked(eventWatcher.subscribe).mock.calls[0][0];
      expect(request.event_type).toBe('zha_event');
      expect(request.matcher).toBeUndefined();

      callEventWatcherCallback(
        eventWatcher,
        createHASSEvent('zha_event', { command: 'press' }),
      );

      expect(eventCallback).toHaveBeenCalledWith({
        cameraID: 'camera_1',
        id: 'event:zha_event',
        type: 'momentary',
      });

      camera.unsubscribe();
      expect(eventWatcher.unsubscribe).toHaveBeenCalledWith(request);
    });

    it('should attach a context-only matcher when only a context filter is set', async () => {
      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event', context: { user_id: 'u-1' } }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ eventWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: true }));
      await camera.initialize();
      camera.subscribe();

      const matcher = vi.mocked(eventWatcher.subscribe).mock.calls[0][0].matcher;
      expect(matcher).toBeDefined();
      expect(
        matcher?.(
          createHASSEvent('zha_event', {}, { id: 'i', user_id: 'u-1', parent_id: null }),
        ),
      ).toBe(true);
      expect(
        matcher?.(
          createHASSEvent('zha_event', {}, { id: 'i', user_id: 'u-2', parent_id: null }),
        ),
      ).toBe(false);
    });

    it('should expand list-form event_type into one subscription per type', async () => {
      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: ['zha_event', 'deconz_event'] }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ eventWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: true }));
      await camera.initialize();
      camera.subscribe();

      expect(eventWatcher.subscribe).toHaveBeenCalledTimes(2);
      expect(vi.mocked(eventWatcher.subscribe).mock.calls[0][0].event_type).toBe(
        'zha_event',
      );
      expect(vi.mocked(eventWatcher.subscribe).mock.calls[1][0].event_type).toBe(
        'deconz_event',
      );
    });

    it('should attach a matcher when triggers.events entry has data filter', async () => {
      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event', event_data: { command: 'press' } }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ eventWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: true }));
      await camera.initialize();
      camera.subscribe();

      const matcher = vi.mocked(eventWatcher.subscribe).mock.calls[0][0].matcher;
      expect(matcher).toBeDefined();
      expect(
        matcher?.(createHASSEvent('zha_event', { command: 'press', extra: 1 })),
      ).toBe(true);
      expect(matcher?.(createHASSEvent('zha_event', { command: 'release' }))).toBe(
        false,
      );
    });

    it('should not subscribe to events when trigger capability is disabled', async () => {
      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event' }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ eventWatcher }) },
      ).setCapabilities(createCapabilities({ trigger: false }));
      await camera.initialize();
      camera.subscribe();

      expect(eventWatcher.subscribe).not.toHaveBeenCalled();
    });

    it('should not dispatch when the helper returns null', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const eventCallback = vi.fn();
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['event.front_door_doorbell'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ stateWatcher }) },
        { eventCallback: eventCallback },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await camera.initialize();
      camera.subscribe();

      callStateWatcherCallback(stateWatcher, {
        entityID: 'event.front_door_doorbell',
        oldState: createStateEntity({ state: 'unavailable' }),
        newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
      });

      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should dispatch a momentary event for an event entity fire', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const eventCallback = vi.fn();
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['event.front_door_doorbell'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ stateWatcher }) },
        { eventCallback: eventCallback },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await camera.initialize();
      camera.subscribe();

      callStateWatcherCallback(stateWatcher, {
        entityID: 'event.front_door_doorbell',
        oldState: createStateEntity({ state: '2026-05-24T12:00:00.000+00:00' }),
        newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
      });

      expect(eventCallback).toHaveBeenCalledTimes(1);
      expect(eventCallback).toHaveBeenCalledWith({
        cameraID: 'camera_1',
        id: 'event.front_door_doorbell',
        type: 'momentary',
      });
    });

    it('should not trigger without trigger capability', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await createSubscribedCamera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['binary_sensor.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        createCapabilities({ trigger: false }),
        stateWatcher,
      );

      expect(stateWatcher.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('should get proxy config', () => {
    it.each([
      [
        'when unspecified',
        {},
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when media set to true',
        { proxy: { media: true } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when media set to false',
        { proxy: { media: false as const } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when media set to auto',
        { proxy: { media: 'auto' as const } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_verification is set to auto',
        { proxy: { ssl_verification: 'auto' as const } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_verification is set to true',
        { proxy: { ssl_verification: true } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_verification is set to false',
        { proxy: { ssl_verification: false } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: false,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_ciphers is set to auto',
        { proxy: { ssl_ciphers: 'auto' as const } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_ciphers is set to modern',
        { proxy: { ssl_ciphers: 'modern' as const } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'modern' as const,
        },
      ],
      [
        'when dynamic is set to false',
        { proxy: { dynamic: false } },
        {
          dynamic: false,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when go2rtc has no url',
        { live_provider: 'go2rtc' },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when go2rtc has a url',
        { live_provider: 'go2rtc', go2rtc: { url: 'http://localhost:1984' } },
        {
          dynamic: true,
          live: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when go2rtc has a url but live is set to false',
        {
          live_provider: 'go2rtc',
          go2rtc: { url: 'http://localhost:1984' },
          proxy: { live: false },
        },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when go2rtc-experimental has no url',
        { live_provider: 'go2rtc-experimental' },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when go2rtc-experimental has a url',
        {
          live_provider: 'go2rtc-experimental',
          go2rtc: { url: 'http://localhost:1984' },
        },
        {
          dynamic: true,
          live: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
    ])(
      '%s',
      (_name: string, cameraConfig: unknown, expectedResult: CameraProxyConfig) => {
        const camera = new Camera(
          createCameraConfig(cameraConfig),
          new GenericCameraManagerEngine(createHASSManager()),
          { hassManager: createHASSManager() },
        );
        expect(camera.getProxyConfig()).toEqual(expectedResult);
      },
    );
  });

  describe('getEndpoints', () => {
    it('should return null when no endpoints are available', () => {
      const camera = new Camera(
        createCameraConfig({
          go2rtc: { stream: '' },
          camera_entity: '',
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      expect(camera.getEndpoints()).toBeNull();
    });

    it('should correctly merge endpoints', async () => {
      const camera = new Camera(
        createCameraConfig({
          go2rtc: {
            url: 'http://go2rtc',
            stream: 'stream',
          },
          camera_entity: 'camera.foo',
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      expect(camera.getEndpoints()).toEqual({
        go2rtc: {
          endpoint: 'http://go2rtc/api/ws?src=stream',
          sign: false,
        },
        webrtcCard: {
          endpoint: 'camera.foo',
        },
      });
    });
  });
  describe('isDegraded', () => {
    it('should not be degraded when every capability could be determined', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(camera.isDegraded()).toBe(false);
    });

    it('should be degraded and omit 2-way-audio when the probe cannot tell', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(null);
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );

      await camera.initialize();

      expect(camera.getCapabilities().getRawCapabilities()).not.toHaveProperty(
        '2-way-audio',
      );
      expect(camera.isDegraded()).toBe(true);
    });

    it('should be degraded when trigger entities cannot be detected', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockResolvedValue(
        createRegistryEntity({ entity_id: 'camera.front_door', device_id: 'device_1' }),
      );
      vi.mocked(entityRegistryManager.getMatchingEntities).mockRejectedValue(
        new Error('registry unavailable'),
      );

      const camera = new TestCamera(
        createCameraConfig({
          camera_entity: 'camera.front_door',
          triggers: { doorbell: true },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager(), entityRegistryManager },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await camera.initialize();

      expect(camera.getTriggerEntities()).toEqual([]);
      expect(camera.isDegraded()).toBe(true);
    });

    it('should not be degraded when a second initialize determines everything', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(null);
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      await camera.initialize();

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);
      await camera.initialize();

      expect(camera.isDegraded()).toBe(false);
    });
  });

  describe('reinitialize', () => {
    it('should claim 2-way-audio once the probe can return a result', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(null);
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      await camera.initialize();

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);
      await camera.reinitialize();

      expect(camera.getCapabilities().has('2-way-audio')).toBe(true);
      expect(camera.isDegraded()).toBe(false);
    });

    it('should stay degraded when the probe still cannot tell', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(null);
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager() },
      );
      await camera.initialize();

      await camera.reinitialize();

      expect(camera.isDegraded()).toBe(true);
    });

    it('should detect trigger entities again once the registry answers', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      const cameraEntity = createRegistryEntity({
        entity_id: 'camera.front_door',
        device_id: 'device_1',
      });
      const doorbellEntity = createRegistryEntity({
        entity_id: 'event.front_door_doorbell',
        device_id: 'device_1',
      });
      const hass = createHASS({
        'event.front_door_doorbell': createStateEntity({
          entity_id: 'event.front_door_doorbell',
          attributes: { device_class: 'doorbell' },
        }),
      });

      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockResolvedValue(cameraEntity);
      vi.mocked(entityRegistryManager.getMatchingEntities).mockRejectedValue(
        new Error('registry unavailable'),
      );

      const camera = new TestCamera(
        createCameraConfig({
          camera_entity: 'camera.front_door',
          triggers: { doorbell: true },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ hass }), entityRegistryManager },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await camera.initialize();
      expect(camera.getTriggerEntities()).toEqual([]);

      vi.mocked(entityRegistryManager.getMatchingEntities).mockResolvedValue([
        doorbellEntity,
      ]);

      await camera.reinitialize();

      expect(camera.getTriggerEntities()).toEqual(['event.front_door_doorbell']);
      expect(camera.isDegraded()).toBe(false);
    });

    it('should subscribe to a newly detected trigger entity', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      const cameraEntity = createRegistryEntity({
        entity_id: 'camera.front_door',
        device_id: 'device_1',
      });
      const doorbellEntity = createRegistryEntity({
        entity_id: 'event.front_door_doorbell',
        device_id: 'device_1',
      });
      const hass = createHASS({
        'event.front_door_doorbell': createStateEntity({
          entity_id: 'event.front_door_doorbell',
          attributes: { device_class: 'doorbell' },
        }),
      });

      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockResolvedValue(cameraEntity);
      vi.mocked(entityRegistryManager.getMatchingEntities).mockRejectedValue(
        new Error('registry unavailable'),
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const camera = new TestCamera(
        createCameraConfig({
          camera_entity: 'camera.front_door',
          triggers: { doorbell: true },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        {
          hassManager: createHASSManager({ hass, stateWatcher }),
          entityRegistryManager,
        },
      ).setCapabilities(createCapabilities({ trigger: true }));

      await camera.initialize();
      camera.subscribe();

      // The registry was unavailable, so the camera subscribed to no entities.
      expect(stateWatcher.subscribe).toHaveBeenCalledWith(expect.any(Function), []);
      vi.mocked(stateWatcher.subscribe).mockClear();

      vi.mocked(entityRegistryManager.getMatchingEntities).mockResolvedValue([
        doorbellEntity,
      ]);

      await camera.reinitialize();

      // The camera unsubscribes and subscribes again, now with the doorbell entity.
      expect(stateWatcher.unsubscribe).toHaveBeenCalled();
      expect(stateWatcher.subscribe).toHaveBeenCalledWith(expect.any(Function), [
        'event.front_door_doorbell',
      ]);
    });

    it('should not detect trigger entities without the trigger capability', async () => {
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);
      const entityRegistryManager = mock<EntityRegistryManager>();
      const camera = new Camera(
        createCameraConfig({
          camera_entity: 'camera.front_door',
          capabilities: { disable: ['trigger'] },
          triggers: { doorbell: true },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager(), entityRegistryManager },
      );

      await camera.reinitialize();

      expect(camera.getCapabilities().has('trigger')).toBe(false);
      expect(entityRegistryManager.getMatchingEntities).not.toHaveBeenCalled();
    });

    it('should do nothing without hass', async () => {
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        { hassManager: createHASSManager({ hass: null }) },
      );

      await camera.reinitialize();

      expect(camera.isDegraded()).toBe(false);
    });
  });
});
