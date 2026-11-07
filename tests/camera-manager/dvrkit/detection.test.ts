import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { CameraManagerEngineFactory } from '../../../src/camera-manager/engine-factory';
import { Engine } from '../../../src/camera-manager/types';
import type { DeviceRegistryManager } from '../../../src/ha/registry/device';
import { createCameraConfig } from '../../config/test-utils';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import { createHASS, createRegistryEntity } from '../../test-utils';

describe('dvrkit engine detection', () => {
  it('accepts an explicitly configured engine', async () => {
    const factory = new CameraManagerEngineFactory(
      new EntityRegistryManagerMock(),
      mock<DeviceRegistryManager>(),
    );
    expect(
      await factory.getEngineForCamera(createHASS(), createCameraConfig({ engine: 'dvrkit' })),
    ).toBe(Engine.Dvrkit);
  });

  it('detects a dvrkit entity from the entity registry', async () => {
    const factory = new CameraManagerEngineFactory(
      new EntityRegistryManagerMock([
        createRegistryEntity({ entity_id: 'camera.front', platform: 'dvrkit' }),
      ]),
      mock<DeviceRegistryManager>(),
    );
    expect(
      await factory.getEngineForCamera(
        createHASS(),
        createCameraConfig({ engine: 'auto', camera_entity: 'camera.front' }),
      ),
    ).toBe(Engine.Dvrkit);
  });
});
