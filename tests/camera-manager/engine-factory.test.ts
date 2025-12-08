import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { FrigateCameraManagerEngine } from '../../src/camera-manager/frigate/engine-frigate';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic';
import { MotionEyeCameraManagerEngine } from '../../src/camera-manager/motioneye/engine-motioneye';
import { ReolinkCameraManagerEngine } from '../../src/camera-manager/reolink/engine-reolink.js';
import { TPLinkCameraManagerEngine } from '../../src/camera-manager/tplink/engine-tplink.js';
import { Engine } from '../../src/camera-manager/types.js';
import { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher.js';
import { CardWideConfig } from '../../src/config/schema/types.js';
import { EntityRegistryManager } from '../../src/ha/registry/entity/types.js';
import { ResolvedMediaCache } from '../../src/ha/resolved-media.js';
import { EntityRegistryManagerMock } from '../ha/registry/entity/mock.js';
import {
  createCameraConfig,
  createHASS,
  createRegistryEntity,
  createStateEntity,
} from '../test-utils';

vi.mock('../../src/utils/ha/entity-registry');
vi.mock('../../src/utils/ha/entity-registry/cache');

const createFactory = (options?: {
  entityRegistryManager?: EntityRegistryManager;
  cardWideConfig?: CardWideConfig;
}): CameraManagerEngineFactory => {
  return new CameraManagerEngineFactory(
    options?.entityRegistryManager ?? new EntityRegistryManagerMock(),
  );
};

describe('getEngineForCamera()', () => {
  describe('should get a frigate camera', () => {
    it('from manually set engine', async () => {
      const config = createCameraConfig({ engine: 'frigate' });
      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.Frigate,
      );
    });

    it('from auto detection', async () => {
      const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
      const entityRegistryManager = new EntityRegistryManagerMock([
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'frigate' }),
      ]);

      expect(
        await createFactory({
          entityRegistryManager: entityRegistryManager,
        }).getEngineForCamera(createHASS(), config),
      ).toBe(Engine.Frigate);
    });

    it('from config with camera_name', async () => {
      const config = createCameraConfig({
        frigate: { client_id: 'bar', camera_name: 'foo' },
      });
      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.Frigate,
      );
    });
  });

  describe('should get a motioneye camera', () => {
    it('from manually set engine', async () => {
      const config = createCameraConfig({ engine: 'motioneye' });
      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.MotionEye,
      );
    });

    it('from auto detection', async () => {
      const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
      const entityRegistryManager = new EntityRegistryManagerMock([
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'motioneye' }),
      ]);

      expect(
        await createFactory({
          entityRegistryManager: entityRegistryManager,
        }).getEngineForCamera(createHASS(), config),
      ).toBe(Engine.MotionEye);
    });
  });

  describe('should get a reolink camera', () => {
    it('from manually set engine', async () => {
      const config = createCameraConfig({ engine: 'reolink' });
      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.Reolink,
      );
    });

    it('from auto detection', async () => {
      const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
      const entityRegistryManager = new EntityRegistryManagerMock([
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'reolink' }),
      ]);

      expect(
        await createFactory({
          entityRegistryManager: entityRegistryManager,
        }).getEngineForCamera(createHASS(), config),
      ).toBe(Engine.Reolink);
    });
  });

  describe('should get a tplink camera', () => {
    it('from manually set engine', async () => {
      const config = createCameraConfig({ engine: 'tplink' });
      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.TPLink,
      );
    });

    it('from auto detection', async () => {
      const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
      const entityRegistryManager = new EntityRegistryManagerMock([
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'tplink' }),
      ]);

      expect(
        await createFactory({
          entityRegistryManager: entityRegistryManager,
        }).getEngineForCamera(createHASS(), config),
      ).toBe(Engine.TPLink);
    });
  });

  describe('should get a generic camera', () => {
    it('from manually set engine', async () => {
      const config = createCameraConfig({ engine: 'generic' });
      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.Generic,
      );
    });

    it('from auto detection', async () => {
      const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
      const entityRegistryManager = new EntityRegistryManagerMock([
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'generic' }),
      ]);

      expect(
        await createFactory({
          entityRegistryManager: entityRegistryManager,
        }).getEngineForCamera(createHASS(), config),
      ).toBe(Engine.Generic);
    });

    it('from entity not in registry but with state', async () => {
      const config = createCameraConfig({
        engine: 'auto',
        webrtc_card: { entity: 'camera.foo' },
      });
      const entityRegistryManager = new EntityRegistryManagerMock();

      expect(
        await createFactory({
          entityRegistryManager: entityRegistryManager,
        }).getEngineForCamera(
          createHASS({
            'camera.foo': createStateEntity(),
          }),
          config,
        ),
      ).toBe(Engine.Generic);
    });

    it('from entity not in registry and not in state', async () => {
      const config = createCameraConfig({
        engine: 'auto',
        webrtc_card: { entity: 'camera.foo' },
      });
      const entityRegistryManager = new EntityRegistryManagerMock();

      expect(
        async () =>
          await createFactory({
            entityRegistryManager: entityRegistryManager,
          }).getEngineForCamera(createHASS(), config),
      ).rejects.toThrow(/Could not find camera entity/);
    });

    it('from webrtc-card url', async () => {
      const config = createCameraConfig({
        engine: 'auto',
        webrtc_card: { url: 'camera.foo' },
      });

      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.Generic,
      );
    });

    it('from go2rtc url and stream', async () => {
      const config = createCameraConfig({
        engine: 'auto',
        go2rtc: { url: 'https://my-go2rtc', stream: 'office' },
      });

      expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
        Engine.Generic,
      );
    });
  });

  it('should get no engine from config with insufficient details', async () => {
    const config = createCameraConfig({});
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBeNull();
  });

  it('should throw error on invalid entity', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = mock<EntityRegistryManager>();
    entityRegistryManager.getEntity.mockRejectedValue(new Error());

    await expect(
      createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).rejects.toThrow();
  });
});

describe('createEngine()', () => {
  it('should create generic engine', async () => {
    expect(
      await createFactory().createEngine(Engine.Generic, {
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
        resolvedMediaCache: mock<ResolvedMediaCache>(),
      }),
    ).toBeInstanceOf(GenericCameraManagerEngine);
  });
  it('should create frigate engine', async () => {
    expect(
      await createFactory().createEngine(Engine.Frigate, {
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
        resolvedMediaCache: mock<ResolvedMediaCache>(),
      }),
    ).toBeInstanceOf(FrigateCameraManagerEngine);
  });
  it('should create motioneye engine', async () => {
    expect(
      await createFactory().createEngine(Engine.MotionEye, {
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
        resolvedMediaCache: mock<ResolvedMediaCache>(),
      }),
    ).toBeInstanceOf(MotionEyeCameraManagerEngine);
  });
  it('should create reolink engine', async () => {
    expect(
      await createFactory().createEngine(Engine.Reolink, {
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
        resolvedMediaCache: mock<ResolvedMediaCache>(),
      }),
    ).toBeInstanceOf(ReolinkCameraManagerEngine);
  });
  it('should create tplink engine', async () => {
    expect(
      await createFactory().createEngine(Engine.TPLink, {
        stateWatcher: mock<StateWatcherSubscriptionInterface>(),
        resolvedMediaCache: mock<ResolvedMediaCache>(),
      }),
    ).toBeInstanceOf(TPLinkCameraManagerEngine);
  });
});
