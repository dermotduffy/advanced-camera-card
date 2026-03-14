import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { MotionEyeCamera } from '../../../src/camera-manager/motioneye/camera';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createCameraConfig, createHASS, createRegistryEntity } from '../../test-utils';

const cameraEntity = createRegistryEntity({
  entity_id: 'camera.motioneye',
  platform: 'motioneye',
});

describe('MotionEyeCamera', () => {
  describe('getProxyConfig', () => {
    it('should proxy media when proxy.media is auto', () => {
      const config = createCameraConfig({
        proxy: { media: 'auto' },
      });
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      expect(camera.getProxyConfig().media).toBe(true);
    });

    it('should respect explicit false for proxy.media', () => {
      const config = createCameraConfig({
        proxy: { media: false },
      });
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      expect(camera.getProxyConfig().media).toBe(false);
    });

    it('should respect explicit true for proxy.media', () => {
      const config = createCameraConfig({
        proxy: { media: true },
      });
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      expect(camera.getProxyConfig().media).toBe(true);
    });
  });

  describe('getEndpoints', () => {
    it('should return UI endpoint when motioneye url set', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.motioneye',
        motioneye: { url: 'http://motioneye.local' },
      });
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        stateWatcher: mock<StateWatcher>(),
      });

      const endpoints = camera.getEndpoints();
      expect(endpoints?.ui).toEqual({
        endpoint: 'http://motioneye.local',
      });
    });

    it('should return null UI endpoint when no url', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.motioneye',
      });
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        stateWatcher: mock<StateWatcher>(),
      });

      const endpoints = camera.getEndpoints();
      expect(endpoints?.ui).toBeUndefined();
    });
  });

  describe('capabilities', () => {
    it('should include clips and snapshots', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.motioneye',
      });
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        stateWatcher: mock<StateWatcher>(),
      });

      const capabilities = camera.getCapabilities();
      expect(capabilities?.has('clips')).toBe(true);
      expect(capabilities?.has('snapshots')).toBe(true);
    });

    it('should include PTZ when configured', async () => {
      const config = createCameraConfig({
        camera_entity: 'camera.motioneye',
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
      const camera = new MotionEyeCamera(config, mock<CameraManagerEngine>());
      await camera.initialize({
        hass: createHASS(),
        entityRegistryManager: new EntityRegistryManagerMock([cameraEntity]),
        stateWatcher: mock<StateWatcher>(),
      });

      const capabilities = camera.getCapabilities();
      expect(capabilities?.getPTZCapabilities()).toBeTruthy();
    });
  });
});
