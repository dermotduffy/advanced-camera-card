import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { TPLinkCamera } from '../../../src/camera-manager/tplink/camera';
import { ActionsExecutor } from '../../../src/card-controller/actions/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createCameraConfig, createHASS, createRegistryEntity } from '../../test-utils';

describe('TPLinkCamera', () => {
  // Entity patterns from: https://github.com/dermotduffy/advanced-camera-card/issues/2183
  const cameraEntity = createRegistryEntity({
    entity_id: 'camera.tapo_c520ws_39d3_live_view',
    unique_id: '80115E1CF270233D6FC2FCD4028181A7206CDB30-live_view',
    platform: 'tplink',
    config_entry_id: 'tplink_config_entry_1',
    device_id: 'tplink_device_1',
  });
  const buttonEntityPanLeft = createRegistryEntity({
    entity_id: 'button.tapo_c520ws_39d3_pan_left',
    unique_id: '80115E1CF270233D6FC2FCD4028181A7206CDB30-pan_left',
    platform: 'tplink',
    config_entry_id: 'tplink_config_entry_1',
    device_id: 'tplink_device_1',
  });
  const buttonEntityPanRight = createRegistryEntity({
    entity_id: 'button.tapo_c520ws_39d3_pan_right',
    unique_id: '80115E1CF270233D6FC2FCD4028181A7206CDB30-pan_right',
    platform: 'tplink',
    config_entry_id: 'tplink_config_entry_1',
    device_id: 'tplink_device_1',
  });
  const buttonEntityTiltUp = createRegistryEntity({
    entity_id: 'button.tapo_c520ws_39d3_tilt_up',
    unique_id: '80115E1CF270233D6FC2FCD4028181A7206CDB30-tilt_up',
    platform: 'tplink',
    config_entry_id: 'tplink_config_entry_1',
    device_id: 'tplink_device_1',
  });
  const buttonEntityTiltDown = createRegistryEntity({
    entity_id: 'button.tapo_c520ws_39d3_tilt_down',
    unique_id: '80115E1CF270233D6FC2FCD4028181A7206CDB30-tilt_down',
    platform: 'tplink',
    config_entry_id: 'tplink_config_entry_1',
    device_id: 'tplink_device_1',
  });

  const ptzPopulatedEntityRegistryManager = new EntityRegistryManagerMock([
    cameraEntity,
    buttonEntityPanLeft,
    buttonEntityPanRight,
    buttonEntityTiltUp,
    buttonEntityTiltDown,

    // Unrelated button for a different config entry
    createRegistryEntity({
      entity_id: 'button.other_device_pan_left',
      unique_id: 'other_device_pan_left',
      platform: 'tplink',
      config_entry_id: 'different_config_entry',
    }),

    // Unrelated button without unique_id
    createRegistryEntity({
      entity_id: 'button.tapo_c520ws_39d3_something',
      platform: 'tplink',
      config_entry_id: 'tplink_config_entry_1',
    }),
  ]);

  describe('should initialize config', () => {
    it('without a camera_entity', async () => {
      const config = createCameraConfig();
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      expect(
        async () =>
          await camera.initialize({
            hass: createHASS(),
            entityRegistryManager: new EntityRegistryManagerMock(),
            stateWatcher: mock<StateWatcher>(),
          }),
      ).rejects.toThrowError('Could not find camera entity');
    });

    it('without a matching entity in registry', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      expect(
        async () =>
          await camera.initialize({
            hass: createHASS(),
            entityRegistryManager: new EntityRegistryManagerMock(),
            stateWatcher: mock<StateWatcher>(),
          }),
      ).rejects.toThrowError('Could not find camera entity');
    });

    it('successfully with webrtc_card.entity fallback', async () => {
      const config = createCameraConfig({
        webrtc_card: {
          entity: 'camera.tapo_c520ws_39d3_live_view',
        },
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      const entityRegistryManager = new EntityRegistryManagerMock([cameraEntity]);

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });

      expect(camera.getEntity()).toBe(cameraEntity);
    });

    it('successfully without PTZ entities', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      const entityRegistryManager = new EntityRegistryManagerMock([cameraEntity]);

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });

      expect(camera.getEntity()).toBe(cameraEntity);
      expect(camera.getCapabilities()?.getPTZCapabilities()).toBeNull();
    });

    describe('successfully with PTZ', () => {
      it('should find PTZ button entities', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.tapo_c520ws_39d3_live_view',
        });
        const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['relative'],
          right: ['relative'],
          up: ['relative'],
          down: ['relative'],
        });
      });

      it('should allow configured PTZ actions to override', async () => {
        const config = createCameraConfig({
          camera_entity: 'camera.tapo_c520ws_39d3_live_view',
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
        const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
        });

        expect(camera.getCapabilities()?.getPTZCapabilities()).toEqual({
          left: ['relative'],
          right: ['relative'],
          up: ['relative'],
          down: ['relative'],
        });
      });
    });
  });

  describe('should execute PTZ action', () => {
    it('should ignore actions without matching button', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      expect(await camera.executePTZAction(executor, 'left')).toBeFalsy();
      expect(
        await camera.executePTZAction(executor, 'left', { phase: 'start' }),
      ).toBeFalsy();

      expect(executor.executeActions).not.toBeCalled();
    });

    it('should ignore zoom actions (not supported by TPLink)', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: ptzPopulatedEntityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      expect(
        await camera.executePTZAction(executor, 'zoom_in', { phase: 'start' }),
      ).toBeFalsy();
      expect(
        await camera.executePTZAction(executor, 'zoom_out', { phase: 'start' }),
      ).toBeFalsy();

      expect(executor.executeActions).not.toBeCalled();
    });

    it('should ignore preset actions (not supported by TPLink)', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: ptzPopulatedEntityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      expect(
        await camera.executePTZAction(executor, 'preset', { preset: 'home' }),
      ).toBeFalsy();

      expect(executor.executeActions).not.toBeCalled();
    });

    it('should handle stop phase (no-op for TPLink)', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: ptzPopulatedEntityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      // Stop should return true (handled) but not execute any actions
      expect(
        await camera.executePTZAction(executor, 'left', { phase: 'stop' }),
      ).toBeTruthy();

      expect(executor.executeActions).not.toBeCalled();
    });

    it.each([
      ['left', 'button.tapo_c520ws_39d3_pan_left'],
      ['right', 'button.tapo_c520ws_39d3_pan_right'],
      ['up', 'button.tapo_c520ws_39d3_tilt_up'],
      ['down', 'button.tapo_c520ws_39d3_tilt_down'],
    ] as const)(
      'should execute %s action (relative movement)',
      async (action, entityId) => {
        const config = createCameraConfig({
          camera_entity: 'camera.tapo_c520ws_39d3_live_view',
        });
        const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: ptzPopulatedEntityRegistryManager,
          stateWatcher: mock<StateWatcher>(),
        });
        const executor = mock<ActionsExecutor>();

        await camera.executePTZAction(executor, action);
        expect(executor.executeActions).toHaveBeenCalledWith({
          actions: [
            {
              action: 'perform-action',
              perform_action: 'button.press',
              target: {
                entity_id: entityId,
              },
            },
          ],
        });
      },
    );

    it('should also work with phase start for compatibility', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: ptzPopulatedEntityRegistryManager,
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      await camera.executePTZAction(executor, 'left', { phase: 'start' });
      expect(executor.executeActions).toHaveBeenCalledWith({
        actions: [
          {
            action: 'perform-action',
            perform_action: 'button.press',
            target: {
              entity_id: 'button.tapo_c520ws_39d3_pan_left',
            },
          },
        ],
      });
    });

    it('should use configured action when provided', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
        ptz: {
          actions_left_start: {
            action: 'perform-action',
            perform_action: 'button.press',
            target: {
              entity_id: 'button.custom_left',
            },
          },
        },
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([
          cameraEntity,
          buttonEntityPanLeft,
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
            entity_id: 'button.custom_left',
          },
        },
      });
    });
  });

  describe('should handle camera without PTZ unique_id pattern', () => {
    it('should not find PTZ entities when unique_id has no _live_view suffix', async () => {
      const cameraWithDifferentUniqueId = createRegistryEntity({
        entity_id: 'camera.tapo_c520ws_39d3',
        unique_id: 'c520ws_39d3_something_else',
        platform: 'tplink',
        config_entry_id: 'tplink_config_entry_1',
      });

      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([
          cameraWithDifferentUniqueId,
          buttonEntityPanLeft,
        ]),
        stateWatcher: mock<StateWatcher>(),
      });

      // Should not find PTZ entities since unique_id doesn't end with _live_view
      expect(camera.getCapabilities()?.getPTZCapabilities()).toBeNull();
    });

    it('should not find PTZ entities when camera has no unique_id', async () => {
      const cameraWithoutUniqueId = createRegistryEntity({
        entity_id: 'camera.tapo_c520ws_39d3_live_view',
        platform: 'tplink',
        config_entry_id: 'tplink_config_entry_1',
      });

      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([
          cameraWithoutUniqueId,
          buttonEntityPanLeft,
        ]),
        stateWatcher: mock<StateWatcher>(),
      });

      // Should not find PTZ entities since camera has no unique_id
      expect(camera.getCapabilities()?.getPTZCapabilities()).toBeNull();
    });
  });

  describe('should handle partial PTZ button availability', () => {
    it('should return false for direction without matching button', async () => {
      // Only has pan_left button, trying to execute pan_right
      const config = createCameraConfig({
        camera_entity: 'camera.tapo_c520ws_39d3_live_view',
      });
      const camera = new TPLinkCamera(config, mock<CameraManagerEngine>());

      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([
          cameraEntity,
          buttonEntityPanLeft, // Only left button available
        ]),
        stateWatcher: mock<StateWatcher>(),
      });
      const executor = mock<ActionsExecutor>();

      // Left should work
      expect(
        await camera.executePTZAction(executor, 'left', { phase: 'start' }),
      ).toBeTruthy();
      expect(executor.executeActions).toHaveBeenCalledTimes(1);

      // Right should fail (no button for it)
      expect(
        await camera.executePTZAction(executor, 'right', { phase: 'start' }),
      ).toBeFalsy();
      expect(executor.executeActions).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });
});
