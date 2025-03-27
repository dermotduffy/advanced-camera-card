import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { ReolinkCamera } from '../../../src/camera-manager/reolink/camera';
import { CameraProxyConfig } from '../../../src/camera-manager/types';
import { ActionsExecutor } from '../../../src/card-controller/actions/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { ProxyConfig } from '../../../src/config/schema/cameras';
import { EntityRegistryManagerLive } from '../../../src/utils/ha/registry/entity';
import { createCameraConfig, createHASS, createRegistryEntity } from '../../test-utils';
import { EntityRegistryManagerMock } from '../../utils/ha/registry/entity/mock';

describe('ReolinkCamera', () => {
  const cameraEntity = createRegistryEntity({
    entity_id: 'camera.office_reolink',
    unique_id: '85270002TS7D4RUP_0_main',
    platform: 'reolink',
  });
  const buttonEntityPTZLeft = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_left',
    unique_id: '85270002TS7D4RUP_0_ptz_left',
    platform: 'reolink',
  });
  const buttonEntityPTZRight = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_right',
    unique_id: '85270002TS7D4RUP_0_ptz_right',
    platform: 'reolink',
  });
  const buttonEntityPTZUp = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_up',
    unique_id: '85270002TS7D4RUP_0_ptz_up',
    platform: 'reolink',
  });
  const buttonEntityPTZDown = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_down',
    unique_id: '85270002TS7D4RUP_0_ptz_down',
    platform: 'reolink',
  });
  const buttonEntityPTZZoomIn = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_zoom_in',
    unique_id: '85270002TS7D4RUP_0_ptz_zoom_in',
    platform: 'reolink',
  });
  const buttonEntityPTZZoomOut = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_zoom_out',
    unique_id: '85270002TS7D4RUP_0_ptz_zoom_out',
    platform: 'reolink',
  });
  const buttonEntityPTZStop = createRegistryEntity({
    entity_id: 'button.office_reolink_ptz_stop',
    unique_id: '85270002TS7D4RUP_0_ptz_stop',
    platform: 'reolink',
  });

  const ptzPopulatedEntityRegistryManager = new EntityRegistryManagerMock([
    cameraEntity,
    buttonEntityPTZLeft,
    buttonEntityPTZRight,
    buttonEntityPTZUp,
    buttonEntityPTZDown,
    buttonEntityPTZZoomIn,
    buttonEntityPTZZoomOut,
    buttonEntityPTZStop,

    // Unrelated button.
    createRegistryEntity({
      entity_id: 'button.office_reolink_ptz_foo',
      unique_id: '85270002TS7D4RUP_0_ptz_foo',
      platform: 'reolink',
    }),

    // Unrelated button without unique_id.
    createRegistryEntity({
      entity_id: 'button.office_reolink_ptz_bar',
      platform: 'reolink',
    }),
  ]);

  describe('should initialize config', () => {
    describe('should detect channel', () => {
      it('without a camera_entity', async () => {
        const config = createCameraConfig();
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager: mock<EntityRegistryManagerLive>(),
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not find camera entity');
      });

      it('without a unique_id', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.office_reolink',
            platform: 'reolink',
          }),
        ]);

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager,
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not initialize Reolink camera');
      });

      it('without a channel in the unique_id', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.office_reolink',
            unique_id: 'invalid',
            platform: 'reolink',
          }),
        ]);

        expect(
          async () =>
            await camera.initialize({
              hass: createHASS(),
              entityRegistryManager,
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
      const entityRegistryManager = new EntityRegistryManagerMock([cameraEntity]);

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });

      expect(camera.getChannel()).toBe(0);
    });

    describe('successfully with PTZ', () => {
      it('should find PTZ button entities', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['continuous'],
          right: ['continuous'],
          up: ['continuous'],
          down: ['continuous'],
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
        });
      });

      it('should allow configured PTZ actions to override', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
          ptz: {
            actions_left: {
              action: 'perform-action',
              perform_action: 'homeassistant.toggle',
              target: {
                entity_id: 'switch.camera_move_left',
              },
            },
          },
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['relative'],
          right: ['continuous'],
          up: ['continuous'],
          down: ['continuous'],
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
        });
      });
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

  describe('should execute PTZ action', () => {
    it('should ignore actions without matching button', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.office_reolink',
      });
      const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      await camera.executePTZAction(executor, 'left');
      await camera.executePTZAction(executor, 'left', { phase: 'start' });

      expect(executor.executeActions).not.toBeCalled();
    });

    it('should ignore actions with configured action', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.office_reolink',
        ptz: {
          actions_left_start: {
            action: 'perform-action',
            perform_action: 'button.press',
            target: {
              entity_id: 'button.foo',
            },
          },
        },
      });
      const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([
          cameraEntity,
          buttonEntityPTZLeft,
        ]),
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();
      await camera.executePTZAction(executor, 'left', { phase: 'start' });

      expect(executor.executeActions).toBeCalledTimes(1);
      expect(executor.executeActions).toHaveBeenLastCalledWith({
        actions: {
          action: 'perform-action',
          perform_action: 'button.press',
          target: {
            entity_id: 'button.foo',
          },
        },
      });
    });

    it('should execute action with matching button', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.office_reolink',
      });
      const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: ptzPopulatedEntityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      await camera.executePTZAction(executor, 'left', { phase: 'start' });
      expect(executor.executeActions).toHaveBeenLastCalledWith({
        actions: [
          {
            action: 'perform-action',
            perform_action: 'button.press',
            target: {
              entity_id: 'button.office_reolink_ptz_left',
            },
          },
        ],
      });

      await camera.executePTZAction(executor, 'left', { phase: 'stop' });
      expect(executor.executeActions).toHaveBeenLastCalledWith({
        actions: [
          {
            action: 'perform-action',
            perform_action: 'button.press',
            target: {
              entity_id: 'button.office_reolink_ptz_stop',
            },
          },
        ],
      });
    });
  });
});
