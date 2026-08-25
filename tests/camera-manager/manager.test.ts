import { add } from 'date-fns';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera.js';
import { Capabilities } from '../../src/camera-manager/capabilities.js';
import type { CameraManagerEngine } from '../../src/camera-manager/engine.js';
import { CameraLifecycleStatus } from '../../src/camera-manager/lifecycle.js';
import {
  CameraManager,
  CameraQueryClassifier,
  QueryResultClassifier,
} from '../../src/camera-manager/manager.js';
import {
  Engine,
  QueryResultsType,
  QueryType,
  type CameraManagerCameraMetadata,
  type EventQuery,
  type EventQueryResults,
  type MediaMetadata,
  type QueryResults,
  type RecordingQuery,
  type RecordingSegmentsQuery,
  type ReviewQuery,
} from '../../src/camera-manager/types.js';
import type { CardController } from '../../src/card-controller/controller.js';
import type { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher.js';
import { sortItems } from '../../src/card-controller/view/sort.js';
import type { CameraConfig } from '../../src/config/schema/cameras.js';
import type { EntityRegistryManager } from '../../src/ha/registry/entity/types.js';
import { QuerySource } from '../../src/query-source.js';
import { PTZMovementType, type Endpoint } from '../../src/types.js';
import { ViewFolder, type ViewItem, type ViewMedia } from '../../src/view/item.js';
import type { ViewItemCapabilities } from '../../src/view/types.js';
import { createCameraConfig } from '../config/test-utils';
import {
  createCardAPI,
  createFolder,
  createHASS,
  createHASSManager,
  createRegistryEntity,
} from '../test-utils.js';
import { generateViewMediaArray, TestViewMedia } from '../view/test-utils';
import {
  createCapabilities,
  settleCameraInitialization,
  TestCamera,
} from './test-utils';

describe('QueryClassifier', () => {
  it('should classify event query', () => {
    expect(CameraQueryClassifier.isEventQuery({ type: QueryType.Event })).toBeTruthy();
    expect(
      CameraQueryClassifier.isEventQuery({ type: QueryType.Recording }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isEventQuery({ type: QueryType.RecordingSegments }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isEventQuery({ type: QueryType.MediaMetadata }),
    ).toBeFalsy();
  });
  it('should classify recording query', () => {
    expect(
      CameraQueryClassifier.isRecordingQuery({ type: QueryType.Event }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isRecordingQuery({ type: QueryType.Recording }),
    ).toBeTruthy();
    expect(
      CameraQueryClassifier.isRecordingQuery({ type: QueryType.RecordingSegments }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isRecordingQuery({ type: QueryType.MediaMetadata }),
    ).toBeFalsy();
  });
  it('should classify recording segments query', () => {
    expect(
      CameraQueryClassifier.isRecordingSegmentsQuery({ type: QueryType.Event }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isRecordingSegmentsQuery({ type: QueryType.Recording }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isRecordingSegmentsQuery({
        type: QueryType.RecordingSegments,
      }),
    ).toBeTruthy();
    expect(
      CameraQueryClassifier.isRecordingSegmentsQuery({ type: QueryType.MediaMetadata }),
    ).toBeFalsy();
  });
  it('should classify media metadata query', () => {
    expect(
      CameraQueryClassifier.isMediaMetadataQuery({ type: QueryType.Event }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isMediaMetadataQuery({ type: QueryType.Recording }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isMediaMetadataQuery({ type: QueryType.RecordingSegments }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isMediaMetadataQuery({ type: QueryType.MediaMetadata }),
    ).toBeTruthy();
  });
  it('should classify review query', () => {
    expect(CameraQueryClassifier.isReviewQuery({ type: QueryType.Event })).toBeFalsy();
    expect(
      CameraQueryClassifier.isReviewQuery({ type: QueryType.Recording }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isReviewQuery({ type: QueryType.RecordingSegments }),
    ).toBeFalsy();
    expect(
      CameraQueryClassifier.isReviewQuery({ type: QueryType.MediaMetadata }),
    ).toBeFalsy();
    expect(CameraQueryClassifier.isReviewQuery({ type: QueryType.Review })).toBeTruthy();
  });
});

describe('QueryResultClassifier', async () => {
  const createResults = (type: Partial<QueryResultsType>): QueryResults => {
    return {
      type: type,
      engine: Engine.Generic,
    };
  };

  it('should classify event query result', async () => {
    expect(
      QueryResultClassifier.isEventQueryResult(createResults(QueryResultsType.Event)),
    ).toBeTruthy();
    expect(
      QueryResultClassifier.isEventQueryResult(
        createResults(QueryResultsType.Recording),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isEventQueryResult(
        createResults(QueryResultsType.RecordingSegments),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isEventQueryResult(
        createResults(QueryResultsType.MediaMetadata),
      ),
    ).toBeFalsy();
  });
  it('should classify recording query result', async () => {
    expect(
      QueryResultClassifier.isRecordingQueryResult(
        createResults(QueryResultsType.Event),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isRecordingQueryResult(
        createResults(QueryResultsType.Recording),
      ),
    ).toBeTruthy();
    expect(
      QueryResultClassifier.isRecordingQueryResult(
        createResults(QueryResultsType.RecordingSegments),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isRecordingQueryResult(
        createResults(QueryResultsType.MediaMetadata),
      ),
    ).toBeFalsy();
  });
  it('should classify recording segments query result', async () => {
    expect(
      QueryResultClassifier.isRecordingSegmentsQueryResult(
        createResults(QueryResultsType.Event),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isRecordingSegmentsQueryResult(
        createResults(QueryResultsType.Recording),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isRecordingSegmentsQueryResult(
        createResults(QueryResultsType.RecordingSegments),
      ),
    ).toBeTruthy();
    expect(
      QueryResultClassifier.isRecordingSegmentsQueryResult(
        createResults(QueryResultsType.MediaMetadata),
      ),
    ).toBeFalsy();
  });
  it('should classify media metadata query result', async () => {
    expect(
      QueryResultClassifier.isMediaMetadataQueryResult(
        createResults(QueryResultsType.Event),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isMediaMetadataQueryResult(
        createResults(QueryResultsType.Recording),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isMediaMetadataQueryResult(
        createResults(QueryResultsType.RecordingSegments),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isMediaMetadataQueryResult(
        createResults(QueryResultsType.MediaMetadata),
      ),
    ).toBeTruthy();
  });
  it('should classify review query result', async () => {
    expect(
      QueryResultClassifier.isReviewQueryResult(createResults(QueryResultsType.Event)),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isReviewQueryResult(
        createResults(QueryResultsType.Recording),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isReviewQueryResult(
        createResults(QueryResultsType.RecordingSegments),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isReviewQueryResult(
        createResults(QueryResultsType.MediaMetadata),
      ),
    ).toBeFalsy();
    expect(
      QueryResultClassifier.isReviewQueryResult(createResults(QueryResultsType.Review)),
    ).toBeTruthy();
  });
});

describe('CameraManager', () => {
  const baseCameraConfig = {
    id: 'id',
    camera_entity: 'camera.foo',
    engine: 'generic',
  };

  const baseEventQuery: EventQuery = {
    source: QuerySource.Camera,
    type: QueryType.Event as const,
    cameraIDs: new Set(['id']),
  };

  const baseEventQueryResults: EventQueryResults = {
    type: QueryResultsType.Event as const,
    engine: Engine.Generic,
  };

  const baseRecordingQuery = {
    source: QuerySource.Camera as const,
    type: QueryType.Recording as const,
    cameraIDs: new Set(['id']),
  };

  const baseRecordingQueryResults = {
    type: QueryResultsType.Recording as const,
    engine: Engine.Generic,
  };

  interface TestCameraEntry {
    config?: CameraConfig;

    // Replaces the built camera, for cases the default path cannot express
    // (e.g. a camera whose initialization completes out of order).
    createCamera?: (cameraConfig: CameraConfig, engine: CameraManagerEngine) => Camera;

    capabilities?: Capabilities;
    stateWatcher?: StateWatcherSubscriptionInterface;

    // A registry manager whose entity lookup rejects makes a normally
    // configured camera fail initialization.
    entityRegistryManager?: EntityRegistryManager;
  }

  const buildCamera = (entry: TestCameraEntry, engine: CameraManagerEngine): Camera => {
    const config = entry.config ?? createCameraConfig(baseCameraConfig);
    return (
      entry.createCamera?.(config, engine) ??
      new TestCamera(config, engine, {
        hassManager: createHASSManager({ stateWatcher: entry.stateWatcher }),
        ...(entry.entityRegistryManager && {
          entityRegistryManager: entry.entityRegistryManager,
        }),
      }).setCapabilities(entry.capabilities ?? createCapabilities())
    );
  };

  const buildCameras = (
    entries: TestCameraEntry[],
    engine: CameraManagerEngine,
  ): Camera[] => entries.map((entry) => buildCamera(entry, engine));

  /**
   * Build a camera that does not complete its initialization until the test
   * releases it, and that reports when that initialization starts. Supply an
   * `error` for a camera that fails instead of initializing.
   */
  const buildSlowInitializingCamera = (
    entry: TestCameraEntry,
    engine: CameraManagerEngine,
    options?: { error?: Error },
  ): {
    camera: Camera;
    hasStarted: Promise<void>;
    releaseInitialization: () => void;
  } => {
    let reportStarted: () => void = () => {};
    const hasStarted = new Promise<void>((resolve) => (reportStarted = resolve));
    let releaseInitialization: () => void = () => {};
    const initializationComplete = new Promise<void>(
      (resolve) => (releaseInitialization = resolve),
    );

    class SlowInitializingCamera extends TestCamera {
      public override async initialize(): Promise<this> {
        reportStarted();
        await initializationComplete;
        if (options?.error) {
          throw options.error;
        }
        return await super.initialize();
      }
    }

    return {
      camera: buildCamera(
        {
          ...entry,
          createCamera: (config, cameraEngine) =>
            new SlowInitializingCamera(config, cameraEngine, {
              hassManager: createHASSManager({ stateWatcher: entry.stateWatcher }),
            }).setCapabilities(entry.capabilities ?? createCapabilities()),
        },
        engine,
      ),
      hasStarted,
      releaseInitialization,
    };
  };

  const createCameraManager = async (
    api: CardController,
    engine?: CameraManagerEngine,
    cameras: TestCameraEntry[] = [{}],
  ): Promise<CameraManager> => {
    const manager = new CameraManager(api);
    await manager.setCameras(
      buildCameras(cameras, engine ?? mock<CameraManagerEngine>()),
    );
    return manager;
  };

  it('should construct', () => {
    const manager = new CameraManager(createCardAPI());
    expect(manager.getStore()).toBeTruthy();
  });

  describe('should set cameras', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should store and subscribe cameras', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const manager = await createCameraManager(
        createCardAPI(),
        mock<CameraManagerEngine>(),
        [{ capabilities: createCapabilities({ trigger: true }), stateWatcher }],
      );

      expect(manager.getStore().getCameraCount()).toBe(1);
      await settleCameraInitialization(manager);
      expect(stateWatcher.subscribe).toHaveBeenCalled();
    });

    it('should isolate a camera that fails initialization', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      const error = new Error('initialization failed');
      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockRejectedValue(error);

      const engine = mock<CameraManagerEngine>();
      const healthyWatcher = mock<StateWatcherSubscriptionInterface>();
      const failingWatcher = mock<StateWatcherSubscriptionInterface>();
      const manager = new CameraManager(createCardAPI());

      const cameras = buildCameras(
        [
          {
            config: createCameraConfig({ ...baseCameraConfig, id: 'healthy' }),
            capabilities: createCapabilities({ trigger: true }),
            stateWatcher: healthyWatcher,
          },
          {
            config: createCameraConfig({ ...baseCameraConfig, id: 'failing' }),
            capabilities: createCapabilities({ trigger: true }),
            stateWatcher: failingWatcher,
            entityRegistryManager,
          },
        ],
        engine,
      );

      await manager.setCameras(cameras);

      // Both cameras are in the store so they can render immediately.
      expect([...manager.getStore().getCameraIDs()]).toEqual(['healthy', 'failing']);

      // The healthy camera subscribes; the failing one never does.
      await settleCameraInitialization(manager);
      expect(healthyWatcher.subscribe).toHaveBeenCalled();
      expect(failingWatcher.subscribe).not.toHaveBeenCalled();
    });

    describe('should discard cameras nothing will own', () => {
      it('should discard cameras set after the manager was destroyed', async () => {
        const stateWatcher = mock<StateWatcherSubscriptionInterface>();
        const engine = mock<CameraManagerEngine>();
        const manager = new CameraManager(createCardAPI());
        const slowCamera = buildSlowInitializingCamera(
          { capabilities: createCapabilities({ trigger: true }), stateWatcher },
          engine,
        );
        const setting = manager.setCameras([slowCamera.camera]);

        await manager.destroy();
        slowCamera.releaseInitialization();
        await setting;

        expect(manager.getStore().getCameraCount()).toBe(0);
        expect(stateWatcher.subscribe).not.toHaveBeenCalled();
      });

      it('should discard cameras superseded by a later set', async () => {
        const supersededWatcher = mock<StateWatcherSubscriptionInterface>();
        const engine = mock<CameraManagerEngine>();
        const manager = new CameraManager(createCardAPI());
        const slowCamera = buildSlowInitializingCamera(
          {
            config: createCameraConfig({ ...baseCameraConfig, id: 'superseded' }),
            capabilities: createCapabilities({ trigger: true }),
            stateWatcher: supersededWatcher,
          },
          engine,
        );

        const superseded = manager.setCameras([slowCamera.camera]);

        await manager.setCameras(
          buildCameras(
            [{ config: createCameraConfig({ ...baseCameraConfig, id: 'current' }) }],
            engine,
          ),
        );

        slowCamera.releaseInitialization();
        await superseded;

        expect([...manager.getStore().getCameraIDs()]).toEqual(['current']);
        expect(supersededWatcher.subscribe).not.toHaveBeenCalled();
      });
    });

    it('should unsubscribe displaced cameras', async () => {
      const oldWatcher = mock<StateWatcherSubscriptionInterface>();
      const newWatcher = mock<StateWatcherSubscriptionInterface>();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(createCardAPI(), engine, [
        {
          config: createCameraConfig({ ...baseCameraConfig, id: 'old' }),
          capabilities: createCapabilities({ trigger: true }),
          stateWatcher: oldWatcher,
        },
      ]);
      await settleCameraInitialization(manager);
      expect(oldWatcher.subscribe).toHaveBeenCalled();

      await manager.setCameras(
        buildCameras(
          [
            {
              config: createCameraConfig({ ...baseCameraConfig, id: 'new' }),
              capabilities: createCapabilities({ trigger: true }),
              stateWatcher: newWatcher,
            },
          ],
          engine,
        ),
      );

      // The displaced camera is unsubscribed when the new set is stored; its
      // replacement subscribes once its own background initialization completes.
      expect([...manager.getStore().getCameraIDs()]).toEqual(['new']);
      expect(oldWatcher.unsubscribe).toHaveBeenCalled();
      await settleCameraInitialization(manager);
      expect(newWatcher.subscribe).toHaveBeenCalled();
    });

    it('should isolate a camera that throws while subscribing', async () => {
      const healthyWatcher = mock<StateWatcherSubscriptionInterface>();
      const error = new Error('subscribe failed');
      const failingWatcher = mock<StateWatcherSubscriptionInterface>();
      vi.mocked(failingWatcher.subscribe).mockImplementation(() => {
        throw error;
      });

      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());
      const cameras = buildCameras(
        [
          {
            config: createCameraConfig({ ...baseCameraConfig, id: 'healthy' }),
            capabilities: createCapabilities({ trigger: true }),
            stateWatcher: healthyWatcher,
          },
          {
            config: createCameraConfig({ ...baseCameraConfig, id: 'failing' }),
            capabilities: createCapabilities({ trigger: true }),
            stateWatcher: failingWatcher,
          },
        ],
        engine,
      );

      await manager.setCameras(cameras);

      // The camera that throws while subscribing is marked failed; the healthy
      // camera subscribes and stays ready.
      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('failing')?.status).toBe(
        CameraLifecycleStatus.Failed,
      );
      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('healthy')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );
      expect(healthyWatcher.subscribe).toHaveBeenCalled();
      expect(healthyWatcher.unsubscribe).not.toHaveBeenCalled();
    });

    it('should limit engine request concurrency when configured', async () => {
      const manager = new CameraManager(createCardAPI());

      await manager.setCameras([], { engineRequestConcurrency: 3 });
      expect(manager['_requestLimit'].concurrency).toBe(3);

      await manager.setCameras([]);
      expect(manager['_requestLimit'].concurrency).toBe(Infinity);
    });

    it('should store cameras before their initialization resolves', async () => {
      const engine = mock<CameraManagerEngine>();
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const manager = new CameraManager(createCardAPI());
      const slowCamera = buildSlowInitializingCamera(
        { capabilities: createCapabilities({ trigger: true }), stateWatcher },
        engine,
      );

      await manager.setCameras([slowCamera.camera]);

      // The camera is present and marked initializing, but has not subscribed.
      expect(manager.getStore().getCameraCount()).toBe(1);
      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Initializing,
      );
      expect(stateWatcher.subscribe).not.toHaveBeenCalled();

      slowCamera.releaseInitialization();
      await settleCameraInitialization(manager);
      expect(stateWatcher.subscribe).toHaveBeenCalled();
    });

    it('should stay ready when the initial trigger evaluation fails', async () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraTriggersManager().handleCameraReady).mockRejectedValue(
        new Error('trigger failed'),
      );
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const manager = await createCameraManager(api, mock<CameraManagerEngine>(), [
        { capabilities: createCapabilities({ trigger: true }), stateWatcher },
      ]);

      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );
    });

    it('should serialize initialization under a request-concurrency limit', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());
      const first = buildSlowInitializingCamera(
        { config: createCameraConfig({ ...baseCameraConfig, id: 'first' }) },
        engine,
      );
      const second = buildSlowInitializingCamera(
        { config: createCameraConfig({ ...baseCameraConfig, id: 'second' }) },
        engine,
      );

      await manager.setCameras([first.camera, second.camera], {
        engineRequestConcurrency: 1,
      });

      await first.hasStarted;

      // The second camera has not started, since the first still occupies the
      // single slot. Racing against an already-resolved promise reports which of
      // the two has settled without waiting for the other.
      const notStarted = Symbol('not-started');
      expect(await Promise.race([second.hasStarted, Promise.resolve(notStarted)])).toBe(
        notStarted,
      );

      first.releaseInitialization();
      await second.hasStarted;

      second.releaseInitialization();
      await settleCameraInitialization(manager);
    });

    it('should discard a set superseded before it reaches the store', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());

      // Two sets are handed over back to back: the first's store write runs
      // after the second has already taken a newer generation.
      const first = manager.setCameras(
        buildCameras(
          [{ config: createCameraConfig({ ...baseCameraConfig, id: 'first' }) }],
          engine,
        ),
      );
      const second = manager.setCameras(
        buildCameras(
          [{ config: createCameraConfig({ ...baseCameraConfig, id: 'second' }) }],
          engine,
        ),
      );
      await Promise.all([first, second]);

      expect([...manager.getStore().getCameraIDs()]).toEqual(['second']);
    });

    it('should discard an initialization failure superseded before it commits', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());
      const slowCamera = buildSlowInitializingCamera({}, engine, {
        error: new Error('initialization failed'),
      });

      await manager.setCameras([slowCamera.camera]);

      await manager.destroy();
      slowCamera.releaseInitialization();

      // The failure commit finds a stale generation, so no lifecycle entry
      // survives.
      await settleCameraInitialization(manager);
      expect(manager.getStore().getCameraCount()).toBe(0);
      expect(manager.getCameraLifecycleState('id')).toBeNull();
    });

    describe('generate default queries', () => {
      const setupManagerWithEngine = async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const engine = mock<CameraManagerEngine>();
        const manager = await createCameraManager(api, engine);

        return { engine, manager };
      };

      it('should generate default event queries', async () => {
        const { engine, manager } = await setupManagerWithEngine();
        const queries: EventQuery[] = [baseEventQuery];

        engine.generateDefaultEventQuery.mockReturnValue(queries);

        expect(manager.generateDefaultEventQueries('id')).toEqual(queries);
      });

      it('should generate default recording queries', async () => {
        const { engine, manager } = await setupManagerWithEngine();
        const queries: RecordingQuery[] = [baseRecordingQuery];

        engine.generateDefaultRecordingQuery.mockReturnValue(queries);

        expect(manager.generateDefaultRecordingQueries('id')).toEqual(queries);
      });

      it('should generate default recording segments queries', async () => {
        const { engine, manager } = await setupManagerWithEngine();
        const queries: RecordingSegmentsQuery[] = [
          {
            type: QueryType.RecordingSegments,
            cameraIDs: new Set(['id']),
            start: new Date(),
            end: new Date(),
          },
        ];

        engine.generateDefaultRecordingSegmentsQuery.mockReturnValue(queries);

        expect(manager.generateDefaultRecordingSegmentsQueries('id')).toEqual(queries);
      });

      it('should generate default review queries', async () => {
        const { engine, manager } = await setupManagerWithEngine();
        const queries: ReviewQuery[] = [
          {
            source: QuerySource.Camera,
            type: QueryType.Review,
            cameraIDs: new Set(['id']),
          },
        ];

        engine.generateDefaultReviewQuery.mockReturnValue(queries);

        expect(manager.generateDefaultReviewQueries('id')).toEqual(queries);
      });

      it('should handle missing camera', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = await createCameraManager(api, mock<CameraManagerEngine>());

        expect(manager.generateDefaultEventQueries('not_a_camera')).toBeNull();
      });

      it('should handle missing queries', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const engine = mock<CameraManagerEngine>();
        const manager = await createCameraManager(api, engine);

        engine.generateDefaultEventQuery.mockReturnValue(null);
        expect(manager.generateDefaultEventQueries('id')).toBeNull();
      });
    });

    describe('getDefaultQueryParameters', () => {
      it('should return empty object for non-existent camera', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = await createCameraManager(api, mock<CameraManagerEngine>());

        expect(
          manager.getDefaultQueryParameters('not_a_camera', QueryType.Event),
        ).toEqual({});
      });

      it('should return parameters from engine for existing camera', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const engine = mock<CameraManagerEngine>();
        const manager = await createCameraManager(api, engine);

        engine.getDefaultQueryParameters.mockReturnValue({ what: new Set(['person']) });
        expect(manager.getDefaultQueryParameters('id', QueryType.Event)).toEqual({
          what: new Set(['person']),
        });
      });
    });

    it('should merge defaults correctly', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine, [
        {
          config: createCameraConfig({
            ...baseCameraConfig,
            triggers: {
              media_events: ['snapshots'],
            },
          }),
        },
      ]);
      expect(
        manager.getStore().getCamera('id')?.getConfig().triggers.media_events,
      ).toEqual(['snapshots']);
    });
  });

  describe('should report issues and and re-initialize cameras', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    /**
     * Create a camera that cannot determine whether it carries two-way audio,
     * until the test calls `set2WayAudio`.
     */
    const createDegradedCamera = (
      engine: CameraManagerEngine,
      options?: { stateWatcher?: StateWatcherSubscriptionInterface },
    ): {
      camera: Camera;
      set2WayAudio: () => void;
      holdNextInitialization: () => { release: () => void };

      // How many times the camera has probed for two-way audio.
      getCapabilityProbeCount: () => number;
    } => {
      let has2WayAudio: boolean | null = null;
      let initializationHeld: Promise<void> | null = null;
      let probeCount = 0;

      class DegradedCamera extends Camera {
        protected override async _has2WayAudioCapability(): Promise<boolean | null> {
          probeCount++;
          if (initializationHeld) {
            await initializationHeld;
          }
          return has2WayAudio;
        }
      }

      return {
        camera: new DegradedCamera(createCameraConfig(baseCameraConfig), engine, {
          hassManager: createHASSManager({ stateWatcher: options?.stateWatcher }),
        }),
        set2WayAudio: (): void => {
          has2WayAudio = true;
        },
        holdNextInitialization: (): { release: () => void } => {
          let release: () => void = () => {};
          initializationHeld = new Promise<void>((resolve) => (release = resolve));
          return { release };
        },
        getCapabilityProbeCount: (): number => probeCount,
      };
    };

    it('should make a degraded camera ready and report it', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const api = createCardAPI();
      const manager = new CameraManager(api);
      const degraded = createDegradedCamera(mock<CameraManagerEngine>(), {
        stateWatcher,
      });

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('id')).toEqual({
        status: CameraLifecycleStatus.Ready,
      });
      expect(stateWatcher.subscribe).toHaveBeenCalled();
      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
          state: 'degraded',
        },
      );
    });

    it('should report nothing for a camera that initialized fully', async () => {
      const api = createCardAPI();
      const manager = new CameraManager(api);
      const complete = createDegradedCamera(mock<CameraManagerEngine>());
      complete.set2WayAudio();

      await manager.setCameras([complete.camera]);
      await settleCameraInitialization(manager);

      expect(api.getIssueManager().resolve).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
        },
      );
      expect(api.getIssueManager().trigger).not.toHaveBeenCalled();
    });

    it('should report a camera that failed to initialize', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      const error = new Error('initialization failed');
      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockRejectedValue(error);

      const api = createCardAPI();
      const manager = new CameraManager(api);

      await manager.setCameras(
        buildCameras([{ entityRegistryManager }], mock<CameraManagerEngine>()),
      );
      await settleCameraInitialization(manager);

      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
          state: 'failed',
          error,
        },
      );
    });

    it('should report a camera that failed to subscribe', async () => {
      const error = new Error('subscribe failed');
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      vi.mocked(stateWatcher.subscribe).mockImplementation(() => {
        throw error;
      });

      const api = createCardAPI();
      const manager = new CameraManager(api);

      await manager.setCameras(
        buildCameras(
          [{ capabilities: createCapabilities({ trigger: true }), stateWatcher }],
          mock<CameraManagerEngine>(),
        ),
      );
      await settleCameraInitialization(manager);

      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
          state: 'failed',
          error,
        },
      );
    });

    it('should initialize a serving camera again without interrupting it', async () => {
      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const api = createCardAPI();
      const manager = new CameraManager(api);
      const degraded = createDegradedCamera(mock<CameraManagerEngine>(), {
        stateWatcher,
      });

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);
      expect(degraded.camera.getCapabilities().has('2-way-audio')).toBe(false);

      degraded.set2WayAudio();
      await manager.reinitializeCamera('id');

      expect(degraded.camera.getCapabilities().has('2-way-audio')).toBe(true);
      expect(api.getIssueManager().resolve).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
        },
      );

      // Re-initializing must not drop the camera's subscriptions.
      expect(stateWatcher.unsubscribe).not.toHaveBeenCalled();
    });

    it('should change the epoch when capabilities change', async () => {
      const manager = new CameraManager(createCardAPI());
      const degraded = createDegradedCamera(mock<CameraManagerEngine>());

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);
      const epoch = manager.getEpoch();

      degraded.set2WayAudio();
      await manager.reinitializeCamera('id');

      expect(manager.getEpoch()).not.toBe(epoch);
    });

    it('should not change the epoch when capabilities are unchanged', async () => {
      const manager = new CameraManager(createCardAPI());
      const degraded = createDegradedCamera(mock<CameraManagerEngine>());

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);
      const epoch = manager.getEpoch();

      await manager.reinitializeCamera('id');

      expect(manager.getEpoch()).toBe(epoch);
    });

    it('should initialize a camera that failed on first initialization', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity)
        .mockRejectedValueOnce(new Error('initialization failed'))
        .mockResolvedValue(createRegistryEntity({ entity_id: 'camera.foo' }));

      const stateWatcher = mock<StateWatcherSubscriptionInterface>();
      const api = createCardAPI();
      const manager = new CameraManager(api);

      await manager.setCameras(
        buildCameras(
          [
            {
              capabilities: createCapabilities({ trigger: true }),
              entityRegistryManager,
              stateWatcher,
            },
          ],
          mock<CameraManagerEngine>(),
        ),
      );
      await settleCameraInitialization(manager);
      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Failed,
      );

      await manager.reinitializeCamera('id');

      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );
      expect(stateWatcher.subscribe).toHaveBeenCalled();
      expect(api.getCameraTriggersManager().handleCameraReady).toHaveBeenCalledWith(
        'id',
      );
      expect(api.getIssueManager().resolve).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
        },
      );
    });

    it('should keep reporting a camera whose initialization throws', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      const api = createCardAPI();
      const manager = new CameraManager(api);
      const degraded = createDegradedCamera(mock<CameraManagerEngine>());

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);

      vi.spyOn(degraded.camera, 'reinitialize').mockRejectedValue(
        new Error('initialization failed'),
      );
      await manager.reinitializeCamera('id');

      expect(api.getIssueManager().trigger).toHaveBeenCalledWith(
        'camera_initialization',
        {
          cameraID: 'id',
          state: 'degraded',
        },
      );
      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );
    });

    it('should ignore a request for an unknown camera', async () => {
      const manager = new CameraManager(createCardAPI());
      const degraded = createDegradedCamera(mock<CameraManagerEngine>());
      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);

      const reinitialize = vi.spyOn(degraded.camera, 'reinitialize');
      await manager.reinitializeCamera('unknown');

      expect(reinitialize).not.toHaveBeenCalled();
    });

    it('should join a pre-existing initialization', async () => {
      const manager = new CameraManager(createCardAPI());
      const degraded = createDegradedCamera(mock<CameraManagerEngine>());

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);
      const probeCountBefore = degraded.getCapabilityProbeCount();

      const { release } = degraded.holdNextInitialization();
      const first = manager.reinitializeCamera('id');
      const second = manager.reinitializeCamera('id');

      release();
      await Promise.all([first, second]);

      // Both requests result in a single initialization.
      expect(degraded.getCapabilityProbeCount()).toBe(probeCountBefore + 1);
    });

    it('should discard an initialization when the manager is destroyed while it runs', async () => {
      const manager = new CameraManager(createCardAPI());
      const degraded = createDegradedCamera(mock<CameraManagerEngine>());

      await manager.setCameras([degraded.camera]);
      await settleCameraInitialization(manager);

      const { release } = degraded.holdNextInitialization();
      const initialization = manager.reinitializeCamera('id');
      await manager.destroy();

      release();
      await initialization;

      expect(manager.getCameraLifecycleState('id')).toBeNull();
    });

    it('should stop reporting cameras that are replaced', async () => {
      const engine = mock<CameraManagerEngine>();
      const api = createCardAPI();
      const manager = new CameraManager(api);

      await manager.setCameras(buildCameras([{}], engine));
      await settleCameraInitialization(manager);
      vi.mocked(api.getIssueManager().reset).mockClear();

      await manager.setCameras(
        buildCameras(
          [{ config: createCameraConfig({ ...baseCameraConfig, id: 'other' }) }],
          engine,
        ),
      );

      expect(api.getIssueManager().reset).toHaveBeenCalledWith('camera_initialization');
    });

    it('should stop reporting cameras when the manager is destroyed', async () => {
      const api = createCardAPI();
      const manager = new CameraManager(api);

      await manager.setCameras(buildCameras([{}], mock<CameraManagerEngine>()));
      await settleCameraInitialization(manager);
      vi.mocked(api.getIssueManager().reset).mockClear();

      await manager.destroy();

      expect(api.getIssueManager().reset).toHaveBeenCalledWith('camera_initialization');
    });
  });

  describe('should track camera lifecycle', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should have no lifecycle for an unknown camera', () => {
      const manager = new CameraManager(createCardAPI());
      expect(manager.getCameraLifecycleState('unknown')).toBeNull();
    });

    it('should be initializing during initialization and ready once committed', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());
      const slowCamera = buildSlowInitializingCamera({}, engine);

      await manager.setCameras([slowCamera.camera]);

      // In the store, but its initialization has not completed.
      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Initializing,
      );

      slowCamera.releaseInitialization();

      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );
    });

    it('should mark a camera failed with its initialization error', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
      const error = new Error('initialization failed');
      const entityRegistryManager = mock<EntityRegistryManager>();
      vi.mocked(entityRegistryManager.getEntity).mockRejectedValue(error);

      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());
      const cameras = buildCameras(
        [
          { config: createCameraConfig({ ...baseCameraConfig, id: 'healthy' }) },
          {
            config: createCameraConfig({ ...baseCameraConfig, id: 'broken' }),
            entityRegistryManager,
          },
        ],
        engine,
      );

      await manager.setCameras(cameras);

      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('broken')).toEqual({
        status: CameraLifecycleStatus.Failed,
        error,
      });
    });

    it('should drop the lifecycle of displaced cameras', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(createCardAPI(), engine, [
        { config: createCameraConfig({ ...baseCameraConfig, id: 'old' }) },
      ]);

      await manager.setCameras(
        buildCameras(
          [{ config: createCameraConfig({ ...baseCameraConfig, id: 'new' }) }],
          engine,
        ),
      );

      expect(manager.getCameraLifecycleState('old')).toBeNull();
      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('new')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );
    });

    it('should clear all lifecycle on destroy', async () => {
      const manager = await createCameraManager(createCardAPI());
      await settleCameraInitialization(manager);

      expect(manager.getCameraLifecycleState('id')?.status).toBe(
        CameraLifecycleStatus.Ready,
      );

      await manager.destroy();

      expect(manager.getCameraLifecycleState('id')).toBeNull();
    });

    it('should replace the epoch on lifecycle changes', async () => {
      const manager = new CameraManager(createCardAPI());

      const before = manager.getEpoch();
      expect(before.manager).toBe(manager);

      await manager.setCameras(buildCameras([{}], mock<CameraManagerEngine>()));

      const after = manager.getEpoch();
      expect(after).not.toBe(before);
      expect(after.manager).toBe(manager);
    });

    it('should report whether any camera is still initializing', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = new CameraManager(createCardAPI());
      const slowCamera = buildSlowInitializingCamera({}, engine);

      await manager.setCameras([slowCamera.camera]);

      expect(manager.hasInitializingCameras()).toBe(true);

      slowCamera.releaseInitialization();
      await settleCameraInitialization(manager);
      expect(manager.hasInitializingCameras()).toBe(false);
    });
  });

  describe('should get media metadata', () => {
    const query = {
      type: QueryType.MediaMetadata as const,
      cameraIDs: new Set('id'),
    };

    it('should handle empty metadata', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const queryResults = {
        type: QueryResultsType.MediaMetadata as const,
        engine: Engine.Generic,
        metadata: {},
      };

      engine.getMediaMetadata.mockResolvedValue(new Map([[query, queryResults]]));
      expect(await manager.getMediaMetadata()).toBeNull();
    });

    it.each([['days'], ['tags'], ['where'], ['what']])(
      'with %s',
      async (metadataType: string) => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const engine = mock<CameraManagerEngine>();
        const manager = await createCameraManager(api, engine);

        const metadata: MediaMetadata = {
          [metadataType]: new Set(['data']),
        };
        const queryResults = {
          type: QueryResultsType.MediaMetadata as const,
          engine: Engine.Generic,
          metadata: metadata,
        };

        engine.getMediaMetadata.mockResolvedValue(new Map([[query, queryResults]]));
        expect(await manager.getMediaMetadata()).toEqual(metadata);
      },
    );
  });

  describe('should get events', () => {
    it('should handle missing hass', async () => {
      const manager = await createCameraManager(createCardAPI());
      expect(await manager.getEvents(baseEventQuery)).toEqual(new Map());
    });

    it('should handle missing cameras', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = await createCameraManager(api);
      expect(
        await manager.getEvents({ ...baseEventQuery, cameraIDs: new Set(['missing']) }),
      ).toEqual(new Map());
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const engineOptions = {};
      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);
      expect(await manager.getEvents(baseEventQuery, engineOptions)).toEqual(results);
      expect(engine.getEvents).toHaveBeenCalledWith(
        hass,
        expect.anything(),
        baseEventQuery,
        engineOptions,
      );
    });
  });

  describe('should review media', () => {
    it('should handle missing camera', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = await createCameraManager(api);
      const media = new TestViewMedia();

      await manager.reviewMedia(media, true);
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(api, engine);
      const media = new TestViewMedia({ cameraID: 'id' });

      await manager.reviewMedia(media, true);

      expect(engine.reviewMedia).toHaveBeenCalledWith(
        hass,
        expect.anything(),
        media,
        true,
      );
    });
  });

  describe('should get recordings', () => {
    it('should succeed', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const engineOptions = {};
      const results = new Map([[baseRecordingQuery, baseRecordingQueryResults]]);
      engine.getRecordings.mockResolvedValue(results);
      expect(await manager.getRecordings(baseRecordingQuery, engineOptions)).toEqual(
        results,
      );
    });
  });

  describe('should get recording segments', () => {
    const query = {
      type: QueryType.RecordingSegments as const,
      cameraIDs: new Set(['id']),
      start: new Date(),
      end: new Date(),
    };

    const queryResults = {
      type: QueryResultsType.RecordingSegments as const,
      engine: Engine.Generic,
      segments: [],
    };

    it('should succeed', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const engineOptions = {};
      const results = new Map([[query, queryResults]]);
      engine.getRecordingSegments.mockResolvedValue(results);
      expect(await manager.getRecordingSegments(query, engineOptions)).toEqual(results);
    });
  });

  describe('should execute media queries', () => {
    it('should handle events', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(api, engine);

      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);
      const media = sortItems(generateViewMediaArray({ count: 5 }));
      engine.generateMediaFromEvents.mockReturnValue(media);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual(media);
    });

    it('should handle no converted media', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(api, engine);

      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);
      engine.generateMediaFromEvents.mockReturnValue(null);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual([]);
    });

    it('should handle missing camera engine during conversion', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(api, engine);

      const results = new Map([
        [baseEventQuery, { ...baseEventQueryResults, engine: Engine.MotionEye }],
      ]);
      engine.getEvents.mockResolvedValue(results);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual([]);
    });

    it('should handle recordings', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(api, engine);

      const results = new Map([[baseRecordingQuery, baseRecordingQueryResults]]);
      engine.getRecordings.mockResolvedValue(results);
      const media = sortItems(generateViewMediaArray({ count: 5 }));
      engine.generateMediaFromRecordings.mockReturnValue(media);

      expect(await manager.executeMediaQueries([baseRecordingQuery])).toEqual(media);
    });

    it('should handle missing hass', async () => {
      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(createCardAPI(), engine);
      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual([]);
    });

    describe('should merge compatible queries', () => {
      it('should merge queries with identical properties', async () => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = await createCameraManager(api, engine, [
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam1' }) },
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam2' }) },
        ]);

        const query1: EventQuery = {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: new Set(['cam1']),
          reviewed: false,
        };
        const query2: EventQuery = {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: new Set(['cam2']),
          reviewed: false,
        };

        engine.getEvents.mockResolvedValue(new Map());
        engine.generateMediaFromEvents.mockReturnValue([]);

        await manager.executeMediaQueries([query1, query2]);

        // Should be called once with merged cameraIDs
        expect(engine.getEvents).toHaveBeenCalledTimes(1);
        expect(engine.getEvents).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            cameraIDs: new Set(['cam1', 'cam2']),
            reviewed: false,
          }),
          undefined,
        );
      });

      it('should not merge queries with different properties', async () => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = await createCameraManager(api, engine, [
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam1' }) },
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam2' }) },
        ]);

        const query1: EventQuery = {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: new Set(['cam1']),
          reviewed: false,
        };
        const query2: EventQuery = {
          source: QuerySource.Camera,
          type: QueryType.Event,
          cameraIDs: new Set(['cam2']),
          reviewed: true,
        };

        engine.getEvents.mockResolvedValue(new Map());
        engine.generateMediaFromEvents.mockReturnValue([]);

        await manager.executeMediaQueries([query1, query2]);

        // Should be called twice for different queries
        expect(engine.getEvents).toHaveBeenCalledTimes(2);
      });

      it('should handle single query without merging', async () => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = await createCameraManager(api, engine);

        engine.getEvents.mockResolvedValue(
          new Map([[baseEventQuery, baseEventQueryResults]]),
        );
        engine.generateMediaFromEvents.mockReturnValue([]);

        await manager.executeMediaQueries([baseEventQuery]);

        expect(engine.getEvents).toHaveBeenCalledTimes(1);
        expect(engine.getEvents).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          baseEventQuery,
          undefined,
        );
      });
    });
  });

  describe('should extend media queries', () => {
    const dateBase = new Date('2024-03-01T20:01:00');
    const mediaTwoCameras = generateViewMediaArray({ count: 5 });
    const mediaMixedStart: ViewItem[] = [
      new TestViewMedia({
        startTime: dateBase,
      }),
      new TestViewMedia({
        startTime: add(dateBase, { days: 1 }),
      }),
      new TestViewMedia({
        startTime: add(dateBase, { days: 2 }),
      }),
      new ViewFolder(createFolder(), []),
    ];

    it('should handle missing hass', async () => {
      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = await createCameraManager(createCardAPI(), engine);
      expect(await manager.extendMediaQueries([baseEventQuery], [], 'later')).toBeNull();
    });

    it.each([
      ['empty query and results', new Map(), [], [], [], null],
      [
        'query without existing media',
        new Map([[baseEventQuery, baseEventQueryResults]]),
        [],
        [{ ...baseEventQuery, limit: 50 }],
        generateViewMediaArray({ count: 5 }),
        {
          queries: [{ ...baseEventQuery, limit: 50 }],
          results: sortItems(generateViewMediaArray({ count: 5 })),
        },
      ],
      [
        'query that extends existing results',
        new Map([[baseEventQuery, baseEventQueryResults]]),
        generateViewMediaArray({ count: 5, cameraIDs: ['kitchen'] }),
        [{ ...baseEventQuery, limit: 50 }],
        generateViewMediaArray({ count: 5, cameraIDs: ['office'] }),
        {
          queries: [{ ...baseEventQuery, limit: 50 }],
          results: sortItems(mediaTwoCameras),
        },
      ],
      [
        'query with existing media but no new media',
        new Map([[baseEventQuery, baseEventQueryResults]]),
        mediaTwoCameras,
        [
          {
            ...baseEventQuery,
            limit: 50,
          },
        ],

        // Fetch identical media again.
        mediaTwoCameras,

        // Returns null to signify nothing new.
        null,
      ],
      [
        'query fetching later',
        new Map([[{ ...baseEventQuery, start: dateBase }, baseEventQueryResults]]),
        mediaMixedStart,
        [
          {
            ...baseEventQuery,
            limit: 50,
            start: add(dateBase, { days: 2 }),
          },
        ],
        mediaTwoCameras,
        {
          queries: [{ ...baseEventQuery, limit: 50, start: dateBase }],
          results: sortItems(mediaMixedStart.concat(mediaTwoCameras)),
        },
        'later' as const,
      ],
      [
        'query fetching earlier',
        new Map([[{ ...baseEventQuery, start: dateBase }, baseEventQueryResults]]),
        mediaMixedStart,
        [
          {
            ...baseEventQuery,
            limit: 50,
            end: dateBase,
          },
        ],
        mediaTwoCameras,
        {
          queries: [{ ...baseEventQuery, limit: 50, start: dateBase }],
          results: sortItems(mediaMixedStart.concat(mediaTwoCameras)),
        },
        'earlier' as const,
      ],
    ])(
      'handles %s',
      async (
        _name: string,
        // The previously submitted query & results.
        inputQueries: Map<EventQuery, EventQueryResults>,

        // The previously received media.
        inputResults: ViewItem[],

        // The queries expected to be dispatched.
        newChunkQueries: EventQuery[],

        // The media received from the new queries.
        outputMediaResults: ViewMedia[],

        // The expect extended queries and results.
        expected?: {
          queries: EventQuery[];
          results: ViewItem[];
        } | null,
        direction?: 'earlier' | 'later',
      ) => {
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = await createCameraManager(api, engine);

        engine.getEvents.mockResolvedValue(inputQueries);
        engine.generateMediaFromEvents.mockReturnValue(outputMediaResults);

        expect(
          await manager.extendMediaQueries(
            [...inputQueries.keys()],
            inputResults,
            direction ?? 'later',
          ),
        ).toEqual(expected);

        // Make sure the issued queries are correct.
        for (const query of newChunkQueries) {
          expect(engine.getEvents).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            query,
            undefined,
          );
        }
      },
    );
  });

  describe('should get media download path', () => {
    it('should handle missing camera', async () => {
      const manager = await createCameraManager(createCardAPI());
      expect(await manager.getMediaDownloadPath(new TestViewMedia())).toBeNull();
    });

    it('should handle missing hass', async () => {
      const api = createCardAPI();
      const manager = await createCameraManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
      expect(await manager.getMediaDownloadPath(new TestViewMedia())).toBeNull();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const result: Endpoint = {
        endpoint: 'http://localhost/path/to/media',
      };
      vi.mocked(engine.getMediaDownloadPath).mockResolvedValue(result);
      expect(
        await manager.getMediaDownloadPath(new TestViewMedia({ cameraID: 'id' })),
      ).toBe(result);
    });
  });

  describe('should get media capabilities', () => {
    it('should handle missing camera', async () => {
      const manager = await createCameraManager(createCardAPI());
      expect(manager.getMediaCapabilities(new TestViewMedia())).toBeNull();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const result: ViewItemCapabilities = {
        canFavorite: false,
        canDownload: false,
      };
      vi.mocked(engine.getMediaCapabilities).mockReturnValue(result);
      expect(manager.getMediaCapabilities(new TestViewMedia({ cameraID: 'id' }))).toBe(
        result,
      );
    });
  });

  describe('should favorite media', () => {
    it('should handle missing camera', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(createCardAPI(), engine);
      manager.favoriteMedia(new TestViewMedia(), true);

      expect(engine.favoriteMedia).not.toHaveBeenCalled();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const media = new TestViewMedia({ cameraID: 'id' });
      manager.favoriteMedia(media, true);
      expect(engine.favoriteMedia).toHaveBeenCalledWith(
        hass,
        expect.anything(),
        media,
        true,
      );
    });
  });

  describe('should get camera endpoints', () => {
    it('should handle missing camera', async () => {
      const manager = await createCameraManager(createCardAPI());
      expect(manager.getCameraEndpoints('BAD')).toBeNull();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      expect(manager.getCameraEndpoints('id', { view: 'live' })).toBeDefined();
    });
  });

  describe('should get camera metadata', () => {
    it('should handle missing camera', async () => {
      const manager = await createCameraManager(createCardAPI());
      expect(manager.getCameraMetadata('BAD')).toBeNull();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const result: CameraManagerCameraMetadata = {
        title: 'My Camera',
        icon: {
          icon: 'mdi:camera',
        },
      };
      vi.mocked(engine.getCameraMetadata).mockReturnValue(result);

      expect(manager.getCameraMetadata('id')).toBe(result);
    });
  });

  describe('should get camera capabilities', () => {
    it('should handle missing camera', async () => {
      const manager = await createCameraManager(createCardAPI());
      expect(manager.getCameraCapabilities('BAD')).toBeNull();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      expect(manager.getCameraCapabilities('id')).toEqual(createCapabilities());
    });
  });

  describe('should get aggregate camera capabilities', () => {
    it('should handle missing camera', async () => {
      const manager = await createCameraManager(createCardAPI());
      const capabilities = manager.getAggregateCameraCapabilities();

      expect(capabilities.has('favorite-events')).toBeFalsy();
      expect(capabilities.has('favorite-recordings')).toBeFalsy();
      expect(capabilities.has('seek')).toBeFalsy();

      expect(capabilities.has('live')).toBeFalsy();
      expect(capabilities.has('clips')).toBeFalsy();
      expect(capabilities.has('recordings')).toBeFalsy();
      expect(capabilities.has('snapshots')).toBeFalsy();
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const manager = await createCameraManager(api, mock<CameraManagerEngine>(), [
        {
          capabilities: new Capabilities({
            'favorite-events': false,
            'favorite-recordings': false,
            seek: false,

            live: false,
            clips: false,
            recordings: false,
            snapshots: false,
          }),
        },
        {
          config: createCameraConfig({ baseCameraConfig, id: 'another' }),
          capabilities: new Capabilities({
            'favorite-events': true,
            'favorite-recordings': true,
            seek: true,

            live: true,
            clips: true,
            recordings: true,
            snapshots: true,

            ptz: {
              left: [PTZMovementType.Continuous],
            },
          }),
        },
      ]);
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const capabilities = manager.getAggregateCameraCapabilities();

      expect(capabilities.has('favorite-events')).toBeTruthy();
      expect(capabilities.has('favorite-recordings')).toBeTruthy();
      expect(capabilities.has('seek')).toBeTruthy();

      expect(capabilities.has('live')).toBeTruthy();
      expect(capabilities.has('clips')).toBeTruthy();
      expect(capabilities.has('recordings')).toBeTruthy();
      expect(capabilities.has('snapshots')).toBeTruthy();
    });
  });

  describe('should execute PTZ action', () => {
    it('should handle missing camera', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = await createCameraManager(api, engine);

      await manager.executePTZAction('missing', 'left', {});

      expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();
    });

    it('should succeed with null hass', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      const action = {
        action: 'perform-action' as const,
        perform_action: 'action',
      };
      const manager = await createCameraManager(api, engine, [
        {
          config: createCameraConfig({
            baseCameraConfig,
            id: 'another',
            ptz: {
              actions_left: action,
            },
          }),
        },
      ]);

      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
      manager.executePTZAction('another', 'left');

      expect(api.getActionsManager().executeActions).toHaveBeenCalledWith({
        actions: action,
      });
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      const action = {
        action: 'perform-action' as const,
        perform_action: 'action',
      };
      const manager = await createCameraManager(api, engine, [
        {
          config: createCameraConfig({
            baseCameraConfig,
            id: 'another',
            ptz: {
              actions_left: action,
            },
          }),
        },
      ]);

      manager.executePTZAction('another', 'left');

      expect(api.getActionsManager().executeActions).toHaveBeenCalledWith({
        actions: action,
      });
    });

    describe('with rotation', () => {
      it.each([
        // No rotation
        [undefined, 'left', 'left', undefined],
        [undefined, 'right', 'right', undefined],
        [undefined, 'up', 'up', undefined],
        [undefined, 'down', 'down', undefined],
        [0, 'left', 'left', undefined],
        [0, 'right', 'right', undefined],
        [0, 'up', 'up', undefined],
        [0, 'down', 'down', undefined],

        // 90° rotation (clockwise view rotation means controls rotate counter-clockwise)
        [90, 'left', 'down', undefined],
        [90, 'right', 'up', undefined],
        [90, 'up', 'left', undefined],
        [90, 'down', 'right', undefined],

        // 180° rotation
        [180, 'left', 'right', undefined],
        [180, 'right', 'left', undefined],
        [180, 'up', 'down', undefined],
        [180, 'down', 'up', undefined],

        // 270° rotation
        [270, 'left', 'up', undefined],
        [270, 'right', 'down', undefined],
        [270, 'up', 'right', undefined],
        [270, 'down', 'left', undefined],

        // Non-directional actions should pass through unchanged
        [90, 'zoom_in', 'zoom_in', undefined],
        [90, 'zoom_out', 'zoom_out', undefined],
        [90, 'preset', 'preset', 'test-preset'],
        [180, 'zoom_in', 'zoom_in', undefined],
        [180, 'zoom_out', 'zoom_out', undefined],
        [180, 'preset', 'preset', 'test-preset'],
        [270, 'zoom_in', 'zoom_in', undefined],
        [270, 'zoom_out', 'zoom_out', undefined],
        [270, 'preset', 'preset', 'test-preset'],
      ] as const)(
        'rotates %s° %s to %s',
        async (rotation, inputAction, expectedAction, preset) => {
          const api = createCardAPI();
          const engine = mock<CameraManagerEngine>();
          const hass = createHASS();
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

          const leftAction = {
            action: 'perform-action' as const,
            perform_action: 'left-action',
          };
          const rightAction = {
            action: 'perform-action' as const,
            perform_action: 'right-action',
          };
          const upAction = {
            action: 'perform-action' as const,
            perform_action: 'up-action',
          };
          const downAction = {
            action: 'perform-action' as const,
            perform_action: 'down-action',
          };
          const zoomInAction = {
            action: 'perform-action' as const,
            perform_action: 'zoom-in-action',
          };
          const zoomOutAction = {
            action: 'perform-action' as const,
            perform_action: 'zoom-out-action',
          };
          const presetAction = {
            action: 'perform-action' as const,
            perform_action: 'preset-action',
          };

          const manager = await createCameraManager(api, engine, [
            {
              config: createCameraConfig({
                baseCameraConfig,
                id: 'rotated-camera',
                dimensions: rotation !== undefined ? { rotation } : undefined,
                ptz: {
                  actions_left: leftAction,
                  actions_right: rightAction,
                  actions_up: upAction,
                  actions_down: downAction,
                  actions_zoom_in: zoomInAction,
                  actions_zoom_out: zoomOutAction,
                  presets: {
                    'test-preset': presetAction,
                  },
                },
              }),
            },
          ]);

          manager.executePTZAction(
            'rotated-camera',
            inputAction,
            preset ? { preset } : undefined,
          );

          // Map expected action to the corresponding action object
          const expectedActionMap = {
            left: leftAction,
            right: rightAction,
            up: upAction,
            down: downAction,
            zoom_in: zoomInAction,
            zoom_out: zoomOutAction,
            preset: presetAction,
          };

          expect(api.getActionsManager().executeActions).toHaveBeenCalledWith({
            actions: expectedActionMap[expectedAction],
          });
        },
      );
    });
  });

  describe('should determine if queries are fresh', () => {
    beforeAll(() => {
      const start = new Date('2024-03-02T20:35:00');
      vi.useFakeTimers();
      vi.setSystemTime(start);
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it.each([
      ['not fresh', new Date('2024-03-02T20:32:00'), false],
      ['fresh on lower bound', new Date('2024-03-02T20:34:00'), true],
      ['fresh at current time', new Date('2024-03-02T20:35:00'), true],
      ['fresh in the future', new Date('2024-03-02T20:40:00'), true],
      [
        'unknown camera',
        new Date('2024-03-02T20:35:00'),

        // Default assumed to be fresh.
        true,
        [
          {
            ...baseEventQuery,
            cameraIDs: new Set(['BAD']),
          },
        ],
      ],
    ])(
      '%s',
      async (
        _name: string,
        resultsTimestamp: Date,
        expectedFresh: boolean,
        queries: EventQuery[] = [baseEventQuery],
      ) => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
        const manager = await createCameraManager(api, engine);

        engine.getQueryResultMaxAge.mockReturnValue(60);
        expect(manager.areMediaQueriesResultsFresh(resultsTimestamp, queries)).toBe(
          expectedFresh,
        );
      },
    );

    it('should always return false for null queries', async () => {
      const manager = await createCameraManager(
        createCardAPI(),
        mock<CameraManagerEngine>(),
      );
      expect(manager.areMediaQueriesResultsFresh(new Date(), null)).toBe(false);
    });
  });

  describe('should get media seek time', () => {
    const startTime = new Date('2024-03-02T20:52:00');
    const endTime = new Date('2024-03-02T20:53:00');
    const middleTime = new Date('2024-03-02T20:52:30');

    describe('invalid requests', () => {
      it.each([
        ['null start and end', null, null, middleTime],
        ['no start', null, endTime, middleTime],
        ['no end', startTime, null, middleTime],
        ['target < start', endTime, endTime, startTime],
        ['target > end', startTime, startTime, endTime],
      ])(
        '%s',
        async (_name: string, start: Date | null, end: Date | null, target: Date) => {
          const api = createCardAPI();
          const engine = mock<CameraManagerEngine>();
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
          const manager = await createCameraManager(api, engine);

          expect(
            await manager.getMediaSeekTime(
              new TestViewMedia({ startTime: start, endTime: end }),
              target,
            ),
          ).toBeNull();
        },
      );
    });

    it('should succeed', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = await createCameraManager(api, engine);

      engine.getMediaSeekTime.mockResolvedValue(42);

      const media = new TestViewMedia({
        cameraID: 'id',
        startTime: startTime,
        endTime: endTime,
      });
      expect(await manager.getMediaSeekTime(media, middleTime)).toBe(42);

      expect(engine.getMediaSeekTime).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        media,
        middleTime,
      );
    });

    it('should handle null return value', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = await createCameraManager(api, engine);

      engine.getMediaSeekTime.mockResolvedValue(null);

      const media = new TestViewMedia({
        cameraID: 'id',
        startTime: startTime,
        endTime: endTime,
      });
      expect(await manager.getMediaSeekTime(media, middleTime)).toBeNull();
    });
  });

  it('should destroy', async () => {
    const api = createCardAPI();
    const engine = mock<CameraManagerEngine>();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    const manager = await createCameraManager(api, engine);

    expect(manager.getStore().getCameraCount()).toBe(1);

    await manager.destroy();

    expect(manager.getStore().getCameraCount()).toBe(0);
  });
});
