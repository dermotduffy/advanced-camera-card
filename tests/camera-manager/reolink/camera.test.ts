import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { ReolinkCamera } from '../../../src/camera-manager/reolink/camera';
import { CameraProxyConfig } from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { ProxyConfig } from '../../../src/config/schema/cameras';
import { EntityRegistryManager } from '../../../src/utils/ha/registry/entity';
import { createCameraConfig, createHASS, createRegistryEntity } from '../../test-utils';

describe('ReolinkCamera', () => {
  describe('should initialize config', () => {
    describe('should detect channel', () => {
      it('without a camera_entity', async () => {
        const config = createCameraConfig();
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager: mock<EntityRegistryManager>(),
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not find camera entity');
      });

      it('without a unique_id', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        const entityRegistryManager = mock<EntityRegistryManager>();
        const entity = createRegistryEntity({
          platform: 'reolink',
        });
        entityRegistryManager.getEntity.mockResolvedValue(entity);

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager: entityRegistryManager,
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not initialize Reolink camera');
      });

      it('without a channel in the unique_id', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        const entityRegistryManager = mock<EntityRegistryManager>();
        const entity = createRegistryEntity({
          unique_id: 'invalid',
          platform: 'reolink',
        });
        entityRegistryManager.getEntity.mockResolvedValue(entity);

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager: entityRegistryManager,
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not initialize Reolink camera');
      });
    });

    it('successfully with main camera', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.office_reolink',
      });
      const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

      const entityRegistryManager = mock<EntityRegistryManager>();
      const entity = createRegistryEntity({
        unique_id: '85270002TS7D4RUP_0_main',
        platform: 'reolink',
      });
      entityRegistryManager.getEntity.mockResolvedValue(entity);

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: entityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });

      expect(camera.getChannel()).toBe(0);
    });
  });

  describe('should get proxy config', () => {
    it.each([
      [
        'when unspecified',
        {},
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when media set to on',
        { media: true },
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when media set to off',
        { media: false },
        {
          dynamic: true,
          media: false,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when media set to auto',
        { media: 'auto' as const },
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_verification is set to auto',
        { ssl_verification: 'auto' as const },
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_verification is set to true',
        { ssl_verification: true },
        {
          dynamic: true,
          media: true,
          ssl_verification: true,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_verification is set to false',
        { ssl_verification: false },
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_ciphers is set to auto',
        { ssl_ciphers: 'auto' as const },
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_ciphers is set to modern',
        { ssl_ciphers: 'modern' as const },
        {
          dynamic: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'modern' as const,
        },
      ],
      [
        'when dynamic is set to false',
        { dynamic: false },
        {
          dynamic: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
    ])(
      '%s',
      (
        _name: string,
        proxyConfig: Partial<ProxyConfig>,
        expectedResult: CameraProxyConfig,
      ) => {
        const camera = new ReolinkCamera(
          createCameraConfig({
            proxy: proxyConfig,
          }),
          mock<CameraManagerEngine>(),
        );
        expect(camera.getProxyConfig()).toEqual(expectedResult);
      },
    );
  });
});
