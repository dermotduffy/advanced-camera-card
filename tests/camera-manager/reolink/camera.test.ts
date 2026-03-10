import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { ReolinkCamera } from '../../../src/camera-manager/reolink/camera';
import { CameraProxyConfig } from '../../../src/camera-manager/types';
import { ActionsExecutor } from '../../../src/card-controller/actions/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { DeviceRegistryManager } from '../../../src/ha/registry/device';
import { EntityRegistryManagerLive } from '../../../src/ha/registry/entity';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import {
  createCameraConfig,
  createHASS,
  createRegistryEntity,
  createStateEntity,
} from '../../test-utils';

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
  const selectEntityPTZ = createRegistryEntity({
    entity_id: 'select.office_reolink_ptz_preset',
    unique_id: '85270002TS7D4RUP_0_ptz_preset',
    platform: 'reolink',
  });

  const numberEntityZoom = createRegistryEntity({
    entity_id: 'number.office_reolink_zoom',
    unique_id: '85270002TS7D4RUP_0_zoom',
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
    selectEntityPTZ,

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
              deviceRegistryManager: mock<DeviceRegistryManager>(),
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
              deviceRegistryManager: mock<DeviceRegistryManager>(),
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not initialize Reolink camera');
      });

      it('without a valid unique_id', async () => {
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
              deviceRegistryManager: mock<DeviceRegistryManager>(),
              stateWatcher: mock<StateWatcher>(),
            }),
        ).rejects.toThrowError('Could not initialize Reolink camera');
      });

      it('successfully with a directly connected camera', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
        const entityRegistryManager = new EntityRegistryManagerMock([cameraEntity]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getChannel()).toBe(0);
      });

      it('successfully with an NVR-connected camera with channel in configuration_url', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.office_reolink',
            unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_main',
            device_id: 'device-id',
            platform: 'reolink',
          }),
        ]);
        const deviceRegistryManager = mock<DeviceRegistryManager>();
        deviceRegistryManager.getDevice.mockResolvedValue({
          id: 'device-id',
          configuration_url: 'http://192.168.1.1?ch=3',
          config_entries: [],
          manufacturer: 'Reolink',
          model: 'RLN8-410',
        });

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager,
          deviceRegistryManager,
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getChannel()).toBe(3);
      });

      it('successfully with hyphenated host id', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.office_reolink',
            unique_id: 'host-id_7_main',
            platform: 'reolink',
          }),
        ]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getChannel()).toBe(7);
      });

      it('successfully with a default fallback channel', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.office_reolink',
            unique_id: 'hostid_channel-uid_main',
            platform: 'reolink',
          }),
        ]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getChannel()).toBe(0);
      });

      it('successfully with colon in host id', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
        const entityRegistryManager = new EntityRegistryManagerMock([
          createRegistryEntity({
            entity_id: 'camera.office_reolink',
            unique_id: 'host:id_7_main',
            platform: 'reolink',
          }),
        ]);

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getChannel()).toBe(7);
      });

      describe('should detect channel from configuration URL', () => {
        it('should return null if device_id is missing', async () => {
          const config = createCameraConfig({
            camera_entity: 'camera.office_reolink',
          });
          const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
          const entityRegistryManager = new EntityRegistryManagerMock([
            createRegistryEntity({
              entity_id: 'camera.office_reolink',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_main',
              // No device_id
              platform: 'reolink',
            }),
          ]);

          await camera.initialize({
            hass: createHASS(),
            entityRegistryManager,
            deviceRegistryManager: mock<DeviceRegistryManager>(),
            stateWatcher: mock<StateWatcher>(),
          });

          expect(camera.getChannel()).toBe(0);
        });

        it('should return null if device has no configuration_url', async () => {
          const config = createCameraConfig({
            camera_entity: 'camera.office_reolink',
          });
          const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
          const entityRegistryManager = new EntityRegistryManagerMock([
            createRegistryEntity({
              entity_id: 'camera.office_reolink',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_main',
              device_id: 'device-id',
              platform: 'reolink',
            }),
          ]);
          const deviceRegistryManager = mock<DeviceRegistryManager>();
          deviceRegistryManager.getDevice.mockResolvedValue({
            id: 'device-id',
            // No configuration_url
            config_entries: [],
            manufacturer: 'Reolink',
            model: 'RLN8-410',
          });

          await camera.initialize({
            hass: createHASS(),
            entityRegistryManager,
            deviceRegistryManager,
            stateWatcher: mock<StateWatcher>(),
          });

          expect(camera.getChannel()).toBe(0);
        });

        it('should return null if configuration_url is invalid', async () => {
          const config = createCameraConfig({
            camera_entity: 'camera.office_reolink',
          });
          const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
          const entityRegistryManager = new EntityRegistryManagerMock([
            createRegistryEntity({
              entity_id: 'camera.office_reolink',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_main',
              device_id: 'device-id',
              platform: 'reolink',
            }),
          ]);
          const deviceRegistryManager = mock<DeviceRegistryManager>();
          deviceRegistryManager.getDevice.mockResolvedValue({
            id: 'device-id',
            configuration_url: 'invalid-url',
            config_entries: [],
            manufacturer: 'Reolink',
            model: 'RLN8-410',
          });

          await camera.initialize({
            hass: createHASS(),
            entityRegistryManager,
            deviceRegistryManager,
            stateWatcher: mock<StateWatcher>(),
          });

          expect(camera.getChannel()).toBe(0);
        });

        it('should return null if ch parameter is not a number', async () => {
          const config = createCameraConfig({
            camera_entity: 'camera.office_reolink',
          });
          const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());
          const entityRegistryManager = new EntityRegistryManagerMock([
            createRegistryEntity({
              entity_id: 'camera.office_reolink',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_main',
              device_id: 'device-id',
              platform: 'reolink',
            }),
          ]);
          const deviceRegistryManager = mock<DeviceRegistryManager>();
          deviceRegistryManager.getDevice.mockResolvedValue({
            id: 'device-id',
            configuration_url: 'http://192.168.1.1?ch=NOT_A_NUMBER',
            config_entries: [],
            manufacturer: 'Reolink',
            model: 'RLN8-410',
          });

          await camera.initialize({
            hass: createHASS(),
            entityRegistryManager,
            deviceRegistryManager,
            stateWatcher: mock<StateWatcher>(),
          });

          expect(camera.getChannel()).toBe(0);
        });
      });
    });

    describe('successfully with PTZ', () => {
      it('should find PTZ button entities with a directly connected camera', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
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

      it('should find PTZ button entities with NVR-connected camera', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            createRegistryEntity({
              entity_id: 'camera.office_reolink',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_main',
              platform: 'reolink',
            }),
            createRegistryEntity({
              entity_id: 'button.office_reolink_ptz_zoom_in',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_ptz_zoom_in',
              platform: 'reolink',
            }),
            createRegistryEntity({
              entity_id: 'button.office_reolink_ptz_zoom_out',
              unique_id: '9527000HXU4V1VHZ_9527000I7E5F1GYU_ptz_zoom_out',
              platform: 'reolink',
            }),
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
        });
      });

      it('should find PTZ select entity', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS({
            'select.office_reolink_ptz_preset': createStateEntity({
              state: 'foo',
              attributes: {
                options: ['preset-one', 'preset-two'],
              },
            }),
          }),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['continuous'],
          right: ['continuous'],
          up: ['continuous'],
          down: ['continuous'],
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
          presets: ['preset-one', 'preset-two'],
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
          deviceRegistryManager: mock<DeviceRegistryManager>(),
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
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when media set to on',
        { proxy: { media: true } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when media set to off',
        { proxy: { media: false } },
        {
          dynamic: true,
          live: false,
          media: false,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when media set to auto',
        { proxy: { media: 'auto' as const } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_verification is set to auto',
        { proxy: { ssl_verification: 'auto' as const } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_verification is set to true',
        { proxy: { ssl_verification: true } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: true,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_verification is set to false',
        { proxy: { ssl_verification: false } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_ciphers is set to auto',
        { proxy: { ssl_ciphers: 'auto' as const } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when ssl_ciphers is set to modern',
        { proxy: { ssl_ciphers: 'modern' as const } },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'modern' as const,
        },
      ],
      [
        'when dynamic is set to false',
        { proxy: { dynamic: false } },
        {
          dynamic: false,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when go2rtc has no url',
        { live_provider: 'go2rtc' },
        {
          dynamic: true,
          live: false,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
      [
        'when go2rtc has a url',
        { live_provider: 'go2rtc', go2rtc: { url: 'http://localhost:1984' } },
        {
          dynamic: true,
          live: true,
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
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
          media: true,
          ssl_verification: false,
          ssl_ciphers: 'intermediate' as const,
        },
      ],
    ])(
      '%s',
      (_name: string, cameraConfig: unknown, expectedResult: CameraProxyConfig) => {
        const camera = new ReolinkCamera(
          createCameraConfig(cameraConfig),
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
        deviceRegistryManager: mock<DeviceRegistryManager>(),
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
        deviceRegistryManager: mock<DeviceRegistryManager>(),
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
        deviceRegistryManager: mock<DeviceRegistryManager>(),
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

    it('should ignore relative actions', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.office_reolink',
      });
      const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: ptzPopulatedEntityRegistryManager,
        deviceRegistryManager: mock<DeviceRegistryManager>(),
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      await camera.executePTZAction(executor, 'left');
      expect(executor.executeActions).not.toHaveBeenCalled();
    });

    describe('should execute preset', () => {
      it('for existing preset', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS({
            'select.office_reolink_ptz_preset': createStateEntity({
              state: 'foo',
              attributes: {
                options: ['preset-one', 'preset-two'],
              },
            }),
          }),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'preset', { preset: 'preset-two' });
        expect(executor.executeActions).toHaveBeenLastCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'select.select_option',
              target: {
                entity_id: 'select.office_reolink_ptz_preset',
              },
              data: {
                option: 'preset-two',
              },
            },
          ],
        });
      });

      it('for non-existant preset', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'preset');
        expect(executor.executeActions).not.toHaveBeenCalled();
      });
    });

    describe('should execute absolute zoom action', () => {
      it('should discover zoom number entity', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          zoomIn: ['relative'],
          zoomOut: ['relative'],
        });
      });

      it('should ignore disabled zoom number entity', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            createRegistryEntity({
              entity_id: 'number.office_reolink_zoom',
              unique_id: '85270002TS7D4RUP_0_zoom',
              platform: 'reolink',
              disabled_by: 'user',
            }),
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toBeNull();
      });

      it('should prefer button entities over number entity for zoom', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            buttonEntityPTZZoomIn,
            buttonEntityPTZZoomOut,
            buttonEntityPTZStop,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          zoomIn: ['continuous'],
          zoomOut: ['continuous'],
        });
      });

      it('should zoom in via number entity', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: '10',
              attributes: { min: 0, max: 33 },
            }),
          }),
        });

        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'number.set_value',
              data: { value: 13 },
              target: { entity_id: 'number.office_reolink_zoom' },
            },
          ],
        });
      });

      it('should zoom out via number entity', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_out', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: '10',
              attributes: { min: 0, max: 33 },
            }),
          }),
        });

        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'number.set_value',
              data: { value: 7 },
              target: { entity_id: 'number.office_reolink_zoom' },
            },
          ],
        });
      });

      it('should clamp zoom in to max', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: '32',
              attributes: { min: 0, max: 33 },
            }),
          }),
        });

        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'number.set_value',
              data: { value: 33 },
              target: { entity_id: 'number.office_reolink_zoom' },
            },
          ],
        });
      });

      it('should clamp zoom out to min', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_out', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: '1',
              attributes: { min: 0, max: 33 },
            }),
          }),
        });

        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'number.set_value',
              data: { value: 0 },
              target: { entity_id: 'number.office_reolink_zoom' },
            },
          ],
        });
      });

      it('should not execute when state is unavailable', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: 'unavailable',
              attributes: { min: 0, max: 33 },
            }),
          }),
        });

        expect(executor.executeActions).not.toHaveBeenCalled();
      });

      it('should not execute when min/max attributes are missing', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: '10',
            }),
          }),
        });

        expect(executor.executeActions).not.toHaveBeenCalled();
      });

      it('should not execute when hass is not provided', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in');

        expect(executor.executeActions).not.toHaveBeenCalled();
      });

      it('should use continuous zoom when button entities exist', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            buttonEntityPTZZoomIn,
            buttonEntityPTZZoomOut,
            buttonEntityPTZStop,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in', { phase: 'start' });

        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'button.press',
              target: { entity_id: 'button.office_reolink_ptz_zoom_in' },
            },
          ],
        });
      });

      it('should not zoom when neither zoom button nor number entity exists', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            buttonEntityPTZLeft,
            buttonEntityPTZStop,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, 'zoom_in', { phase: 'start' });

        expect(executor.executeActions).not.toHaveBeenCalled();
      });

      it('should use step of at least 1', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.office_reolink',
        });
        const camera = new ReolinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([
            cameraEntity,
            numberEntityZoom,
          ]),
          deviceRegistryManager: mock<DeviceRegistryManager>(),
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        // Range of 5: 10% = 0.5, rounds to 1, step = max(1, 1) = 1.
        await camera.executePTZAction(executor, 'zoom_in', {
          hass: createHASS({
            'number.office_reolink_zoom': createStateEntity({
              state: '2',
              attributes: { min: 0, max: 5 },
            }),
          }),
        });

        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'number.set_value',
              data: { value: 3 },
              target: { entity_id: 'number.office_reolink_zoom' },
            },
          ],
        });
      });
    });
  });
});
