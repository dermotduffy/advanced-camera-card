import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera.js';
import { Capabilities } from '../../src/camera-manager/capabilities.js';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import type { CameraManagerEngine } from '../../src/camera-manager/engine.js';
import { CameraManagerStore } from '../../src/camera-manager/store.js';
import { Engine } from '../../src/camera-manager/types.js';
import type { CameraConfig } from '../../src/config/schema/cameras.js';
import type { DeviceRegistryManager } from '../../src/ha/registry/device/index.js';
import type { EntityRegistryManager } from '../../src/ha/registry/entity/types.js';
import type { ResolvedMediaCache } from '../../src/ha/resolved-media.js';
import { createCameraConfig } from '../config/test-utils';
import { createHASSManager } from '../test-utils.js';
import { TestViewMedia } from '../view/test-utils';
import { createInitializedCamera } from './test-utils';

describe('CameraManagerStore', async () => {
  const configVisible = createCameraConfig({
    id: 'camera-visible',
  });
  const configHidden = createCameraConfig({
    id: 'camera-hidden',
    hide: true,
  });

  const engineFactory = new CameraManagerEngineFactory(
    mock<EntityRegistryManager>(),
    mock<DeviceRegistryManager>(),
  );

  const engineGeneric = await engineFactory.createEngine(Engine.Generic, {
    hassManager: createHASSManager(),
    resolvedMediaCache: mock<ResolvedMediaCache>(),
  });
  const engineFrigate = await engineFactory.createEngine(Engine.Frigate, {
    hassManager: createHASSManager(),
    resolvedMediaCache: mock<ResolvedMediaCache>(),
  });

  const createCamera = (config: CameraConfig, engine: CameraManagerEngine): Camera =>
    new Camera(config, engine, { hassManager: createHASSManager() });

  const setupStore = (): CameraManagerStore => {
    const store = new CameraManagerStore();
    store.addCamera(createCamera(configVisible, engineGeneric));
    store.addCamera(createCamera(configHidden, engineFrigate));
    return store;
  };

  it('getCameraConfig', async () => {
    const store = setupStore();
    expect(store.getCameraConfig('camera-visible')).toBe(configVisible);
    expect(store.getCameraConfig('camera-hidden')).toBe(configHidden);
    expect(store.getCameraConfig('camera-not-exist')).toBeNull();
  });

  it('hasCameraID', async () => {
    const store = setupStore();
    expect(store.hasCameraID('camera-visible')).toBeTruthy();
    expect(store.hasCameraID('camera-hidden')).toBeTruthy();
  });

  it('getCameraCount', async () => {
    const store = setupStore();
    expect(store.getCameraCount()).toBe(2);
  });

  describe('getDefaultCameraID', () => {
    it('with camera', async () => {
      const store = setupStore();
      expect(store.getDefaultCameraID()).toBe('camera-visible');
    });
    it('without camera', async () => {
      const store = new CameraManagerStore();
      expect(store.getDefaultCameraID()).toBeNull();
    });
  });

  describe('getCamera', async () => {
    it('present', async () => {
      const store = setupStore();
      expect(store.getCamera('camera-visible')?.getConfig()).toEqual(configVisible);
    });

    it('absent', async () => {
      const store = setupStore();
      expect(store.getCamera('not-a-camera')).toBeNull();
    });
  });

  describe('getCameraConfigs', async () => {
    it('all', async () => {
      const store = setupStore();
      expect([...store.getCameraConfigs()]).toEqual([configVisible, configHidden]);
    });

    it('named', async () => {
      const store = setupStore();
      expect([...store.getCameraConfigs(['camera-visible', 'not-a-camera'])]).toEqual([
        configVisible,
      ]);
    });
  });

  describe('getCameraConfigEntries', async () => {
    it('all', async () => {
      const store = setupStore();
      expect([...store.getCameraConfigEntries()]).toEqual([
        ['camera-visible', configVisible],
        ['camera-hidden', configHidden],
      ]);
    });

    it('named', async () => {
      const store = setupStore();
      expect([
        ...store.getCameraConfigEntries(['camera-visible', 'not-a-camera']),
      ]).toEqual([['camera-visible', configVisible]]);
    });
  });

  it('getCameras', async () => {
    const store = setupStore();
    expect([...store.getCameras().keys()]).toEqual(['camera-visible', 'camera-hidden']);
    expect(store.getCameras().get('camera-visible')?.getConfig()).toEqual(configVisible);
    expect(store.getCameras().get('camera-hidden')?.getConfig()).toEqual(configHidden);
  });

  it('getCameraIDs', async () => {
    const store = setupStore();
    expect(store.getCameraIDs()).toEqual(new Set(['camera-visible', 'camera-hidden']));
  });

  it('should reset by emptying the store and returning all removed cameras', () => {
    const store = setupStore();
    const cameras = [...store.getCameras().values()];

    const removed = store.reset();

    expect(store.getCameraCount()).toBe(0);
    expect(removed).toEqual(cameras);
  });

  describe('getCameraForMedia', () => {
    it('should return the camera for media with a camera ID', async () => {
      const store = setupStore();

      const media = new TestViewMedia({ cameraID: 'camera-visible' });
      expect(store.getCameraForMedia(media)?.getID()).toBe('camera-visible');

      const unknownMedia = new TestViewMedia({ cameraID: 'camera-not-exist' });
      expect(store.getCameraForMedia(unknownMedia)).toBeNull();
    });

    it('should return null for media without a camera ID', async () => {
      const store = setupStore();

      expect(store.getCameraForMedia(new TestViewMedia({ cameraID: null }))).toBeNull();
    });
  });

  it('getEngineOfType', async () => {
    const store = setupStore();
    expect(store.getEngineOfType(Engine.Generic)).toBe(engineGeneric);
    expect(store.getEngineOfType(Engine.Frigate)).toBe(engineFrigate);
    expect(store.getEngineOfType(Engine.MotionEye)).toBeNull();
  });

  it('getEngineForCameraID', async () => {
    const store = setupStore();
    expect(store.getEngineForCameraID('camera-visible')).toBe(engineGeneric);
    expect(store.getEngineForCameraID('camera-hidden')).toBe(engineFrigate);
    expect(store.getEngineForCameraID('camera-not-exist')).toBeNull();
  });

  describe('getEnginesForCameraIDs', async () => {
    it('empty input', async () => {
      const store = setupStore();
      expect(store.getEnginesForCameraIDs(new Set())).toBeNull();
    });

    it('multiple cameras', async () => {
      const store = setupStore();
      store.addCamera(
        createCamera(
          {
            ...configVisible,
            id: 'camera-visible2',
          },
          engineGeneric,
        ),
      );

      expect(
        store.getEnginesForCameraIDs(
          new Set([
            'camera-visible',
            'camera-visible2',
            'camera-hidden',
            'camera-not-exist',
          ]),
        ),
      ).toEqual(
        new Map([
          [engineGeneric, new Set(['camera-visible', 'camera-visible2'])],
          [engineFrigate, new Set(['camera-hidden'])],
        ]),
      );
    });
  });

  describe('getEngineForMedia', () => {
    it('should return the engine for media with a camera ID', async () => {
      const store = setupStore();
      const media = new TestViewMedia({ cameraID: 'camera-visible' });
      expect(store.getEngineForMedia(media)).toBe(engineGeneric);
    });

    it('should return null as the engine for media without a camera ID', async () => {
      const store = setupStore();
      const media = new TestViewMedia({ cameraID: null });
      expect(store.getEngineForMedia(media)).toBeNull();
    });
  });

  describe('getAllDependentCameras', () => {
    it('should return dependent cameras', () => {
      const store = new CameraManagerStore();
      store.addCamera(
        createCamera(
          createCameraConfig({
            id: 'one',
            dependencies: {
              cameras: ['two', 'three'],
            },
          }),
          engineGeneric,
        ),
      );
      store.addCamera(
        createCamera(
          createCameraConfig({
            id: 'two',
          }),
          engineGeneric,
        ),
      );
      expect(store.getAllDependentCameras('one')).toEqual(new Set(['one', 'two']));
    });
    it('should return all cameras', () => {
      const store = new CameraManagerStore();
      store.addCamera(
        createCamera(
          createCameraConfig({
            id: 'one',
            dependencies: {
              all_cameras: true,
            },
          }),
          engineGeneric,
        ),
      );
      store.addCamera(
        createCamera(
          createCameraConfig({
            id: 'two',
          }),
          engineGeneric,
        ),
      );
      expect(store.getAllDependentCameras('one')).toEqual(new Set(['one', 'two']));
    });

    it('should return cameras with specific capabilities', async () => {
      const store = new CameraManagerStore();
      store.addCamera(
        createCamera(
          createCameraConfig({
            id: 'one',
            dependencies: {
              all_cameras: true,
            },
          }),
          engineGeneric,
        ),
      );
      store.addCamera(
        await createInitializedCamera(
          createCameraConfig({
            id: 'two',
          }),
          engineGeneric,
          new Capabilities({ clips: true }),
        ),
      );
      expect(store.getAllDependentCameras('one', 'clips')).toEqual(new Set(['two']));
    });

    it('should return cameras with specific capabilities inclusive of parent', async () => {
      const store = new CameraManagerStore();
      store.addCamera(
        createCamera(
          createCameraConfig({
            id: 'one',
            dependencies: {
              all_cameras: true,
            },
          }),
          engineGeneric,
        ),
      );
      store.addCamera(
        await createInitializedCamera(
          createCameraConfig({
            id: 'two',
          }),
          engineGeneric,
          new Capabilities({ clips: true }),
        ),
      );
      expect(store.getAllDependentCameras('one', 'clips', { inclusive: true })).toEqual(
        new Set(['one', 'two']),
      );
    });
  });

  it('getCameraIDsWithCapability', async () => {
    const store = new CameraManagerStore();
    store.addCamera(
      await createInitializedCamera(
        createCameraConfig({
          id: 'one',
        }),
        engineGeneric,
        new Capabilities({ clips: true }),
      ),
    );
    store.addCamera(
      createCamera(
        createCameraConfig({
          id: 'two',
        }),
        engineGeneric,
      ),
    );
    expect(store.getCameraIDsWithCapability('clips')).toEqual(new Set(['one']));
  });

  describe('setCameras', () => {
    it('should return no displaced cameras when nothing is displaced', () => {
      const store = new CameraManagerStore();
      const camera = createCamera(createCameraConfig({ id: 'camera-1' }), engineGeneric);

      expect(store.setCameras([camera])).toEqual([]);
      expect(store.setCameras([camera])).toEqual([]);
    });

    it('should set cameras and return the displaced cameras', () => {
      const store = new CameraManagerStore();
      const camera_1 = createCamera(
        createCameraConfig({ id: 'camera-1' }),
        engineGeneric,
      );
      const camera_2 = createCamera(
        createCameraConfig({ id: 'camera-2' }),
        engineGeneric,
      );
      const camera_3 = createCamera(
        createCameraConfig({ id: 'camera-3' }),
        engineGeneric,
      );
      const camera_3_new = createCamera(
        createCameraConfig({ id: 'camera-3' }),
        engineGeneric,
      );
      const camera_4 = createCamera(
        createCameraConfig({ id: 'camera-4' }),
        engineGeneric,
      );

      store.setCameras([camera_1, camera_2, camera_3]);
      const displaced = store.setCameras([camera_2, camera_3_new, camera_4]);

      expect(store.getCamera('camera-1')).toBeNull();
      expect(store.getCamera('camera-2')).toBe(camera_2);
      expect(store.getCamera('camera-3')).toBe(camera_3_new);
      expect(store.getCamera('camera-4')).toBe(camera_4);

      // Removed and replaced cameras are displaced; unchanged and newly-set
      // cameras are not.
      expect(displaced).toContain(camera_1);
      expect(displaced).toContain(camera_3);
      expect(displaced).not.toContain(camera_2);
      expect(displaced).not.toContain(camera_3_new);
      expect(displaced).not.toContain(camera_4);
    });
  });
});
