import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera';
import type { CameraManagerEngine } from '../../src/camera-manager/engine';
import type { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory';
import {
  CameraDuplicateIDError,
  CameraNoEngineError,
  CameraNoIDError,
} from '../../src/camera-manager/error';
import { CameraFactory } from '../../src/camera-manager/factory';
import { Engine } from '../../src/camera-manager/types';
import type { HASSManagerReadonlyInterface } from '../../src/card-controller/hass/types';
import type { CameraConfig } from '../../src/config/schema/cameras';
import type { EntityRegistryManager } from '../../src/ha/registry/entity/types';
import type { ResolvedMediaCache } from '../../src/ha/resolved-media';
import { createCameraConfig } from '../config/test-utils';
import { createHASS, createHASSManager } from '../test-utils';

interface FactoryTestContext {
  factory: CameraFactory;
  engineFactory: CameraManagerEngineFactory;
  engine: CameraManagerEngine;
  entityRegistryManager: EntityRegistryManager;
  hassManager: HASSManagerReadonlyInterface;
  resolvedMediaCache: ResolvedMediaCache;
}

const createFactory = (options?: {
  engineFactory?: CameraManagerEngineFactory;
  eventCallback?: () => void;
}): FactoryTestContext => {
  const engineFactory = options?.engineFactory ?? mock<CameraManagerEngineFactory>();
  const engine = mock<CameraManagerEngine>();
  const entityRegistryManager = mock<EntityRegistryManager>();
  const hassManager = createHASSManager();
  const resolvedMediaCache = mock<ResolvedMediaCache>();

  vi.mocked(engineFactory.getEngineForCamera).mockResolvedValue(Engine.Generic);
  vi.mocked(engineFactory.createEngine).mockResolvedValue(engine);
  vi.mocked(engine.createCamera).mockImplementation(
    (cameraConfig: CameraConfig) =>
      new Camera(cameraConfig, engine, { hassManager: createHASSManager() }),
  );

  return {
    factory: new CameraFactory(engineFactory, {
      hassManager,
      entityRegistryManager,
      resolvedMediaCache,
      eventCallback: options?.eventCallback,
    }),
    engineFactory,
    engine,
    entityRegistryManager,
    hassManager,
    resolvedMediaCache,
  };
};

describe('CameraFactory', () => {
  it('should build a camera per config in order with IDs assigned', async () => {
    const { factory } = createFactory();

    const cameras = await factory.buildCameras(createHASS(), [
      createCameraConfig({ id: 'first', engine: 'generic' }),
      createCameraConfig({ camera_entity: 'camera.second', engine: 'generic' }),
    ]);

    expect(cameras.map((camera) => camera.getID())).toEqual(['first', 'camera.second']);
  });

  it('should throw when a camera has no derivable ID', async () => {
    const { factory } = createFactory();

    await expect(
      factory.buildCameras(createHASS(), [createCameraConfig({ engine: 'generic' })]),
    ).rejects.toThrow(CameraNoIDError);
  });

  it('should throw on duplicate camera IDs', async () => {
    const { factory } = createFactory();

    await expect(
      factory.buildCameras(createHASS(), [
        createCameraConfig({ id: 'DUPLICATE', engine: 'generic' }),
        createCameraConfig({ id: 'DUPLICATE', engine: 'generic' }),
      ]),
    ).rejects.toThrow(CameraDuplicateIDError);
  });

  it('should throw when a camera has no engine', async () => {
    const { factory, engineFactory } = createFactory();
    vi.mocked(engineFactory.getEngineForCamera).mockResolvedValue(null);

    await expect(
      factory.buildCameras(createHASS(), [createCameraConfig({ id: 'id' })]),
    ).rejects.toThrow(CameraNoEngineError);
  });

  it('should create one engine per engine type', async () => {
    const eventCallback = vi.fn();
    const { factory, engineFactory, hassManager, resolvedMediaCache } = createFactory({
      eventCallback,
    });

    await factory.buildCameras(createHASS(), [
      createCameraConfig({ id: 'one', engine: 'generic' }),
      createCameraConfig({ id: 'two', engine: 'generic' }),
    ]);

    expect(engineFactory.createEngine).toHaveBeenCalledTimes(1);
    expect(engineFactory.createEngine).toHaveBeenCalledWith(Engine.Generic, {
      eventCallback,
      hassManager,
      resolvedMediaCache,
    });
  });

  describe('should fetch the entity list when a camera needs trigger detection', () => {
    it.each([['motion' as const], ['occupancy' as const], ['doorbell' as const]])(
      'should fetch with %s trigger',
      async (triggerKey) => {
        const { factory, entityRegistryManager } = createFactory();
        const hass = createHASS();

        await factory.buildCameras(hass, [
          createCameraConfig({
            id: 'id',
            engine: 'generic',
            triggers: { [triggerKey]: true },
          }),
        ]);

        expect(entityRegistryManager.fetchEntityList).toHaveBeenCalledWith(hass);
      },
    );

    it('should skip without an entity based trigger', async () => {
      const { factory, entityRegistryManager } = createFactory();

      await factory.buildCameras(createHASS(), [
        createCameraConfig({ id: 'id', engine: 'generic' }),
      ]);

      expect(entityRegistryManager.fetchEntityList).not.toHaveBeenCalled();
    });
  });
});
