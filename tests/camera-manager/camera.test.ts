import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera.js';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic.js';
import type { CameraProxyConfig } from '../../src/camera-manager/types.js';
import type { EventWatcherSubscriptionInterface } from '../../src/card-controller/hass/event-watcher.js';
import type { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher.js';
import { liveProviderSupports2WayAudio } from '../../src/utils/live-provider.js';
import { EntityRegistryManagerMock } from '../ha/registry/entity/mock.js';
import {
  callEventWatcherCallback,
  callStateWatcherCallback,
  createCameraConfig,
  createCapabilities,
  createHASS,
  createHASSEvent,
  createHASSManager,
  createInitializedCamera,
  createRegistryEntity,
  createStateEntity,
} from '../test-utils.js';

vi.mock('../../src/utils/live-provider.js');

describe('Camera', () => {
  it('should get config', async () => {
    const config = createCameraConfig();
    const camera = new Camera(
      config,
      new GenericCameraManagerEngine(createHASSManager()),
    );
    expect(camera.getConfig()).toBe(config);
  });

  describe('should get capabilities', async () => {
    it('when populated', async () => {
      const capabilities = createCapabilities();
      const camera = await createInitializedCamera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
        capabilities,
      );
      expect(camera.getCapabilities()).toBe(capabilities);
    });

    it('when unpopulated', async () => {
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(createHASSManager()),
      );
      expect(camera.getCapabilities()).toBeNull();
    });
  });

  it('should get engine', async () => {
    const engine = new GenericCameraManagerEngine(createHASSManager());
    const camera = new Camera(createCameraConfig(), engine);
    expect(camera.getEngine()).toBe(engine);
  });

  it('should set and get id', async () => {
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(createHASSManager()),
    );
    camera.setID('foo');
    expect(camera.getID()).toBe('foo');
    expect(camera.getConfig().id).toBe('foo');
  });

  it('should throw without id', async () => {
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(createHASSManager()),
    );
    expect(() => camera.getID()).toThrowError(
      'Could not determine camera id for the following ' +
        "camera, may need to set 'id' parameter manually",
    );
  });

  describe('initialize', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should initialize and destroy', async () => {
      const camera = new Camera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ stateWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      expect(stateWatcher.subscribe).toBeCalledWith(expect.any(Function), [
        'camera.foo',
      ]);

      await camera.destroy();

      expect(stateWatcher.unsubscribe).toBeCalled();
    });

    it('should skip initialization when hass is unavailable', async () => {
      const camera = new Camera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ hass: null, stateWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      expect(stateWatcher.subscribe).not.toBeCalled();
      expect(camera.getCapabilities()).toBeNull();
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
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hassManager: createHASSManager(),
      });

      expect(liveProviderSupports2WayAudio).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        2,
        {
          endpoint:
            'http://go2rtc/api/streams?src=stream&video=all&audio=all&microphone',
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
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(false);

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hassManager: createHASSManager(),
      });

      expect(liveProviderSupports2WayAudio).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        20,
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });

    it('should pass proxy config when web proxy is available', async () => {
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
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      const hass = createHASS();
      hass.config.components = ['hass_web_proxy'];

      await camera.initialize({
        hassManager: createHASSManager({ hass }),
      });

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
      );

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
      );
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hassManager: createHASSManager(),
      });

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
        );

        await camera.initialize({
          hassManager: createHASSManager(),
          entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        });

        expect(camera.getEntity()).toEqual(cameraEntity);
      });

      it('should leave entity null when camera_entity is unset', async () => {
        const camera = new Camera(
          createCameraConfig(),
          new GenericCameraManagerEngine(createHASSManager()),
        );

        await camera.initialize({
          hassManager: createHASSManager(),
          entityRegistryManager: new EntityRegistryManagerMock(),
        });

        expect(camera.getEntity()).toBeNull();
      });

      it('should leave entity null when entityRegistryManager is not provided', async () => {
        const camera = new Camera(
          createCameraConfig({ camera_entity: 'camera.front_door' }),
          new GenericCameraManagerEngine(createHASSManager()),
        );

        await camera.initialize({
          hassManager: createHASSManager(),
        });

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
          const camera = new Camera(
            createCameraConfig({
              camera_entity: 'camera.front_door',
              triggers: {
                doorbell: options?.doorbell ?? true,
                ...(options?.userEntities && { entities: options.userEntities }),
              },
            }),
            new GenericCameraManagerEngine(createHASSManager()),
          );
          const stateWatcher = mock<StateWatcherSubscriptionInterface>();
          const hass = createHASS(
            options?.stateEntities ?? {
              'event.front_door_doorbell': createStateEntity({
                entity_id: 'event.front_door_doorbell',
                attributes: { device_class: 'doorbell' },
              }),
            },
          );
          await camera.initialize({
            hassManager: createHASSManager({ hass, stateWatcher }),
            ...(!options?.omitRegistryManager && {
              entityRegistryManager: new EntityRegistryManagerMock(
                options?.registryEntities ?? [cameraEntity, doorbellEntity],
              ),
            }),
            capabilityOptions: {
              capabilities: createCapabilities({
                trigger: options?.triggerCapability ?? true,
              }),
            },
          });
          return { camera, stateWatcher };
        };

        it('should auto-include doorbell event entity from camera device', async () => {
          const { camera } = await initializeDoorbellCamera();
          expect(camera.getConfig().triggers.entities).toEqual([
            'event.front_door_doorbell',
          ]);
        });

        it('should skip discovery when triggers.doorbell is false', async () => {
          const { camera } = await initializeDoorbellCamera({ doorbell: false });
          expect(camera.getConfig().triggers.entities).toEqual([]);
        });

        it('should skip discovery when camera entity has no device_id', async () => {
          const { camera } = await initializeDoorbellCamera({ deviceID: null });
          expect(camera.getConfig().triggers.entities).toEqual([]);
        });

        it('should skip discovery when trigger capability is disabled', async () => {
          const { camera } = await initializeDoorbellCamera({
            triggerCapability: false,
          });
          expect(camera.getConfig().triggers.entities).toEqual([]);
        });

        it('should skip discovery when entityRegistryManager is not provided', async () => {
          const { camera } = await initializeDoorbellCamera({
            omitRegistryManager: true,
          });
          expect(camera.getConfig().triggers.entities).toEqual([]);
        });

        it('should de-duplicate against user-supplied entities', async () => {
          const { camera } = await initializeDoorbellCamera({
            userEntities: ['event.front_door_doorbell', 'binary_sensor.driveway'],
          });
          expect(camera.getConfig().triggers.entities).toEqual([
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
          expect(camera.getConfig().triggers.entities).toEqual([]);
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
          expect(camera.getConfig().triggers.entities).toEqual([]);
        });

        it('should subscribe to discovered doorbell entities for state changes', async () => {
          const { stateWatcher } = await initializeDoorbellCamera();
          expect(stateWatcher.subscribe).toBeCalledWith(expect.any(Function), [
            'event.front_door_doorbell',
          ]);
        });
      });
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
        const camera = new Camera(
          createCameraConfig({
            id: 'camera_1',
            triggers: {
              entities: ['binary_sensor.foo'],
            },
          }),
          new GenericCameraManagerEngine(createHASSManager()),
          {
            eventCallback: eventCallback,
          },
        );

        const stateWatcher = mock<StateWatcherSubscriptionInterface>();
        await camera.initialize({
          hassManager: createHASSManager({ stateWatcher }),
          capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
        });

        expect(stateWatcher.subscribe).toBeCalled();

        const diff = {
          entityID: 'sensor.force_update',
          oldState: createStateEntity({ state: stateFrom }),
          newState: createStateEntity({ state: stateTo }),
        };
        callStateWatcherCallback(stateWatcher, diff);

        expect(eventCallback).toBeCalledWith({
          cameraID: 'camera_1',
          id: 'sensor.force_update',
          type: eventType,
        });
      },
    );

    it('should subscribe to configured triggers.events and dispatch momentary events', async () => {
      const eventCallback = vi.fn();
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event' }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        { eventCallback },
      );

      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ eventWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      expect(eventWatcher.subscribe).toBeCalledTimes(1);
      const request = vi.mocked(eventWatcher.subscribe).mock.calls[0][0];
      expect(request.event_type).toBe('zha_event');
      expect(request.matcher).toBeUndefined();

      callEventWatcherCallback(
        eventWatcher,
        createHASSEvent('zha_event', { command: 'press' }),
      );

      expect(eventCallback).toBeCalledWith({
        cameraID: 'camera_1',
        id: 'event:zha_event',
        type: 'momentary',
      });

      await camera.destroy();
      expect(eventWatcher.unsubscribe).toBeCalled();
    });

    it('should attach a context-only matcher when only a context filter is set', async () => {
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event', context: { user_id: 'u-1' } }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
      );

      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ eventWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

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
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: ['zha_event', 'deconz_event'] }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
      );

      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ eventWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      expect(eventWatcher.subscribe).toBeCalledTimes(2);
      expect(vi.mocked(eventWatcher.subscribe).mock.calls[0][0].event_type).toBe(
        'zha_event',
      );
      expect(vi.mocked(eventWatcher.subscribe).mock.calls[1][0].event_type).toBe(
        'deconz_event',
      );
    });

    it('should attach a matcher when triggers.events entry has data filter', async () => {
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event', event_data: { command: 'press' } }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
      );

      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ eventWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

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
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            events: [{ event_type: 'zha_event' }],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
      );

      const eventWatcher = mock<EventWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ eventWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: false }) },
      });

      expect(eventWatcher.subscribe).not.toBeCalled();
    });

    it('should not dispatch when the helper returns null', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const eventCallback = vi.fn();
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['event.front_door_doorbell'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        {
          eventCallback: eventCallback,
        },
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ stateWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      callStateWatcherCallback(stateWatcher, {
        entityID: 'event.front_door_doorbell',
        oldState: createStateEntity({ state: 'unavailable' }),
        newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
      });

      expect(eventCallback).not.toBeCalled();
    });

    it('should dispatch a momentary event for an event entity fire', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const eventCallback = vi.fn();
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['event.front_door_doorbell'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        {
          eventCallback: eventCallback,
        },
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ stateWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      callStateWatcherCallback(stateWatcher, {
        entityID: 'event.front_door_doorbell',
        oldState: createStateEntity({ state: '2026-05-24T12:00:00.000+00:00' }),
        newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
      });

      expect(eventCallback).toBeCalledTimes(1);
      expect(eventCallback).toBeCalledWith({
        cameraID: 'camera_1',
        id: 'event.front_door_doorbell',
        type: 'momentary',
      });
    });

    it('should not trigger without trigger capability', async () => {
      const eventCallback = vi.fn();
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['binary_sensor.foo'],
          },
        }),
        new GenericCameraManagerEngine(createHASSManager()),
        {
          eventCallback: eventCallback,
        },
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hassManager: createHASSManager({ stateWatcher }),
        capabilityOptions: { capabilities: createCapabilities({ trigger: false }) },
      });

      expect(stateWatcher.subscribe).not.toBeCalled();
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
    ])(
      '%s',
      (_name: string, cameraConfig: unknown, expectedResult: CameraProxyConfig) => {
        const camera = new Camera(
          createCameraConfig(cameraConfig),
          new GenericCameraManagerEngine(createHASSManager()),
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
});
