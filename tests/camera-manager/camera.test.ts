import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Camera } from '../../src/camera-manager/camera.js';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic.js';
import { CameraProxyConfig } from '../../src/camera-manager/types.js';
import { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher.js';
import { ProxyConfig } from '../../src/config/types.js';
import {
  callStateWatcherCallback,
  createCameraConfig,
  createCapabilities,
  createStateEntity,
} from '../test-utils.js';

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
      const camera = new Camera(
        createCameraConfig(),
        new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
        {
          capabilities: capabilities,
        },
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

  it('should initialize and destroy', async () => {
    const camera = new Camera(
      createCameraConfig({
        triggers: {
          entities: ['camera.foo'],
        },
      }),
      new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
      {
        capabilities: createCapabilities({ trigger: true }),
      },
    );

    const stateWatcher = mock<StateWatcherSubscriptionInterface>();
    await camera.initialize({
      stateWatcher: stateWatcher,
    });

    expect(stateWatcher.subscribe).toBeCalledWith(expect.any(Function), ['camera.foo']);

    await camera.destroy();

    expect(stateWatcher.unsubscribe).toBeCalled();
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
            capabilities: createCapabilities({ trigger: true }),
            eventCallback: eventCallback,
          },
        );

        const stateWatcher = mock<StateWatcherSubscriptionInterface>();
        await camera.initialize({
          stateWatcher: stateWatcher,
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
          capabilities: createCapabilities({ trigger: false }),
          eventCallback: eventCallback,
        },
      );

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      await camera.initialize({
        stateWatcher: stateWatcher,
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
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when media set to true',
        { media: true },
        {
          dynamic: true,
          media: true,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when media set to false',
        { media: false as const },
        {
          dynamic: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when media set to auto',
        { media: 'auto' as const },
        {
          dynamic: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_verification is set to auto',
        { ssl_verification: 'auto' as const },
        {
          dynamic: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_verification is set to true',
        { ssl_verification: true },
        {
          dynamic: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_verification is set to false',
        { ssl_verification: false },
        {
          dynamic: true,
          media: false,
          ssl_verification: false,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_ciphers is set to auto',
        { ssl_ciphers: 'auto' as const },
        {
          dynamic: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
      [
        'when ssl_ciphers is set to modern',
        { ssl_ciphers: 'modern' as const },
        {
          dynamic: true,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'modern' as const,
        },
      ],
      [
        'when dynamic is set to false',
        { dynamic: false },
        {
          dynamic: false,
          media: false,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
        },
      ],
    ])(
      '%s',
      (
        _name: string,
        proxyConfig: Partial<ProxyConfig>,
        expectedResult: CameraProxyConfig,
      ) => {
        const camera = new Camera(
          createCameraConfig({
            proxy: proxyConfig,
          }),
          new GenericCameraManagerEngine(mock<StateWatcherSubscriptionInterface>()),
        );
        expect(camera.getProxyConfig()).toEqual(expectedResult);
      },
    );
  });
});
