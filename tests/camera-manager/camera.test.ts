import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Camera } from '../../src/camera-manager/camera.js';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic.js';
import { CameraProxyConfig } from '../../src/camera-manager/types.js';
import { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher.js';
import { liveProviderSupports2WayAudio } from '../../src/utils/live-provider.js';
import {
  callStateWatcherCallback,
  createCameraConfig,
  createCapabilities,
  createHASS,
  createInitializedCamera,
  createStateEntity,
} from '../test-utils.js';

vi.mock('../../src/utils/live-provider.js');

describe('Camera', () => {
  it('should get config', async () => {
    const config = createCameraConfig();
    const camera = new Camera(
      config,
      new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
    );
    expect(camera.getConfig()).toBe(config);
  });

  describe('should get capabilities', async () => {
    it('when populated', async () => {
      const capabilities = createCapabilities();
      const camera = await createInitializedCamera(
        createCameraConfig(),
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
        capabilities,
      );
      expect(camera.getCapabilities()).toBe(capabilities);
    });

    it('when unpopulated', async () => {
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );
      expect(camera.getCapabilities()).toBeNull();
    });
  });

  it('should get engine', async () => {
    const engine = new GenericCameraManagerEngine(
      mock<StateWatcherSubscriptionInterface>(),
    );
    const camera = new Camera(createCameraConfig(), engine);
    expect(camera.getEngine()).toBe(engine);
  });

  it('should set and get id', async () => {
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
    );
    camera.setID('foo');
    expect(camera.getID()).toBe('foo');
    expect(camera.getConfig().id).toBe('foo');
  });

  it('should throw without id', async () => {
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hass: createHASS(),
        stateWatcher: stateWatcher,
        capabilityOptions: { capabilities: createCapabilities({ trigger: true }) },
      });

      expect(stateWatcher.subscribe).toBeCalledWith(expect.any(Function), [
        'camera.foo',
      ]);

      await camera.destroy();

      expect(stateWatcher.unsubscribe).toBeCalled();
    });

    it('should set capabilities and use go2rtc metadata endpoint', async () => {
      const camera = new Camera(
        createCameraConfig({
          go2rtc: {
            url: 'http://go2rtc',
            stream: 'stream',
          },
        }),
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(false);

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      const hass = createHASS();
      hass.config.components = ['hass_web_proxy'];

      await camera.initialize({
        hass,
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      );
      vi.mocked(liveProviderSupports2WayAudio).mockResolvedValue(true);

      await camera.initialize({
        hass: createHASS(),
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
      });

      expect(liveProviderSupports2WayAudio).toHaveBeenCalled();
      expect(camera.getCapabilities()?.has('2-way-audio')).toBe(true);
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
          new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
          {
            eventCallback: eventCallback,
          },
        );

        const stateWatcher = mock<StateWatcherSubscriptionInterface>();
        await camera.initialize({
          hass: createHASS(),
          stateWatcher: stateWatcher,
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

    it('should not trigger without trigger capability', async () => {
      const eventCallback = vi.fn();
      const camera = new Camera(
        createCameraConfig({
          id: 'camera_1',
          triggers: {
            entities: ['binary_sensor.foo'],
          },
        }),
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
        {
          eventCallback: eventCallback,
        },
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        hass: createHASS(),
        stateWatcher: stateWatcher,
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
          new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
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
