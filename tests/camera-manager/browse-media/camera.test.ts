import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BrowseMediaCamera } from '../../../src/camera-manager/browse-media/camera';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { StateWatcherSubscriptionInterface } from '../../../src/card-controller/hass/state-watcher';
import {
  Entity,
  EntityRegistryManager,
} from '../../../src/utils/ha/registry/entity/types';
import { createCameraConfig, createHASS } from '../../test-utils';

describe('BrowseMediaCamera', () => {
  describe('should initialize', () => {
    it('without a camera_entity', async () => {
      const camera = new BrowseMediaCamera(
        createCameraConfig(),
        mock<CameraManagerEngine>(),
      );

      expect(
        async () =>
          await camera.initialize({
            hass: createHASS(),
            stateWatcher: mock<StateWatcherSubscriptionInterface>(),
            entityRegistryManager: mock<EntityRegistryManager>(),
          }),
      ).rejects.toThrowError(/Could not find camera entity/);
    });

    it('with a camera_entity', async () => {
      const camera = new BrowseMediaCamera(
        createCameraConfig({
          camera_entity: 'camera.foo',
        }),
        mock<CameraManagerEngine>(),
      );
      const entityRegistryManager = mock<EntityRegistryManager>();
      const entity = mock<Entity>();
      entityRegistryManager.getEntity.mockResolvedValue(entity);

      expect(
        await camera.initialize({
          hass: createHASS(),
          stateWatcher: mock<StateWatcherSubscriptionInterface>(),
          entityRegistryManager: entityRegistryManager,
        }),
      ).toBe(camera);
      expect(camera.getEntity()).toBe(entity);
    });
  });
});
