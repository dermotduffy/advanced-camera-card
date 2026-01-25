import { add } from 'date-fns';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Camera } from '../../src/camera-manager/camera.js';
import { Capabilities } from '../../src/camera-manager/capabilities.js';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { CameraManagerEngine } from '../../src/camera-manager/engine.js';
import {
  CameraManager,
  CameraQueryClassifier,
  QueryResultClassifier,
} from '../../src/camera-manager/manager.js';
import {
  CameraEvent,
  CameraManagerCameraMetadata,
  Engine,
  EventQuery,
  EventQueryResults,
  MediaMetadata,
  QueryResults,
  QueryResultsType,
  QueryType,
} from '../../src/camera-manager/types.js';
import { CardController } from '../../src/card-controller/controller.js';
import { sortItems } from '../../src/card-controller/view/sort.js';
import { CameraConfig } from '../../src/config/schema/cameras.js';
import { HomeAssistant } from '../../src/ha/types.js';
import { QuerySource } from '../../src/query-source.js';
import { Endpoint, PTZMovementType } from '../../src/types.js';
import { ViewFolder, ViewItem, ViewMedia } from '../../src/view/item.js';
import { ViewItemCapabilities } from '../../src/view/types.js';
import {
  TestViewMedia,
  createCameraConfig,
  createCapabilities,
  createCardAPI,
  createConfig,
  createFolder,
  createHASS,
  createInitializedCamera,
  generateViewMediaArray,
} from '../test-utils.js';

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

  const createCameraManager = (
    api: CardController,
    engine?: CameraManagerEngine,
    cameras: {
      config?: CameraConfig;
      engineType?: Engine | null;
      capabilties?: Capabilities;
    }[] = [{}],
    factory?: CameraManagerEngineFactory,
  ): CameraManager => {
    const camerasConfig = cameras?.map(
      (camera) => camera.config ?? createCameraConfig(baseCameraConfig),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: camerasConfig,
      }),
    );

    const mockFactory = factory ?? mock<CameraManagerEngineFactory>();
    const mockEngine = engine ?? mock<CameraManagerEngine>();
    vi.mocked(mockFactory.createEngine).mockResolvedValueOnce(mockEngine);

    for (const camera of cameras ?? []) {
      const engineType =
        camera.engineType === undefined ? Engine.Generic : camera.engineType;
      if (engineType) {
        vi.mocked(mockEngine.createCamera).mockImplementationOnce(
          async (_hass: HomeAssistant, cameraConfig: CameraConfig): Promise<Camera> =>
            await createInitializedCamera(
              cameraConfig,
              mockEngine,
              camera.capabilties ?? createCapabilities(),
            ),
        );
      }
      vi.mocked(mockFactory.getEngineForCamera).mockResolvedValueOnce(engineType);
    }

    return new CameraManager(api, { factory: mockFactory });
  };

  it('should construct', () => {
    const manager = new CameraManager(createCardAPI());
    expect(manager.getStore()).toBeTruthy();
  });

  describe('should initialize cameras from config', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = createCameraManager(api);

      await manager.initializeCamerasFromConfig();
      expect(manager.getStore().getCameraCount()).toBe(1);
      expect(manager.isInitialized()).toBeTruthy();
    });

    it('without hass', async () => {
      const manager = createCameraManager(createCardAPI());

      await manager.initializeCamerasFromConfig();
      expect(manager.getStore().getCameraCount()).toBe(0);
    });

    it('without a config', async () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

      const manager = createCameraManager(api);

      await manager.initializeCamerasFromConfig();
      expect(manager.getStore().getCameraCount()).toBe(0);
    });

    it('without an id', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = createCameraManager(api, mock<CameraManagerEngine>(), [
        {
          config: createCameraConfig({
            // No id.
            engine: 'generic',
          }),
        },
      ]);
      expect(await manager.initializeCamerasFromConfig()).toBeFalsy();
      expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(
        new Error(
          'Could not determine camera id for the following camera, ' +
            "may need to set 'id' parameter manually",
        ),
        'Camera initialization failed',
      );
    });

    it('with a duplicate id', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const cameraConfig = createCameraConfig({
        id: 'DUPLICATE',
        engine: 'generic',
      });
      const manager = createCameraManager(api, mock<CameraManagerEngine>(), [
        {
          config: cameraConfig,
        },
        {
          config: cameraConfig,
        },
      ]);
      expect(await manager.initializeCamerasFromConfig()).toBeFalsy();
      expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(
        new Error(
          'Duplicate camera id for the following camera, ' +
            "use the 'id' parameter to uniquely identify cameras",
        ),
        'Camera initialization failed',
      );
    });

    it('with no engine', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const manager = createCameraManager(api, mock<CameraManagerEngine>(), [
        {
          config: createCameraConfig({
            id: 'id',
          }),
          engineType: null,
        },
      ]);
      expect(await manager.initializeCamerasFromConfig()).toBeFalsy();
      expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(
        new Error('Could not determine suitable engine for camera'),
        'Camera initialization failed',
      );
    });

    it('should pass events to triggers manager', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const factory = mock<CameraManagerEngineFactory>();
      const manager = createCameraManager(
        api,
        mock<CameraManagerEngine>(),
        [{}],
        factory,
      );
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
      const eventCallback = factory.createEngine.mock.calls[0][1].eventCallback;

      const cameraEvent: CameraEvent = {
        cameraID: 'camera',
        type: 'new',
      };
      eventCallback?.(cameraEvent);
      expect(api.getTriggersManager().handleCameraEvent).toBeCalledWith(cameraEvent);
    });

    describe('should fetch entity list when required', () => {
      it('with entity based trigger', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api, mock<CameraManagerEngine>(), [
          {
            config: createCameraConfig({
              ...baseCameraConfig,
              triggers: {
                occupancy: true,
              },
            }),
          },
        ]);

        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
        expect(api.getEntityRegistryManager().fetchEntityList).toBeCalled();
      });

      it('without entity based trigger', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api);

        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
        expect(api.getEntityRegistryManager().fetchEntityList).not.toBeCalled();
      });
    });

    describe('generate default queries', () => {
      it.each([
        [
          QueryType.Event as const,
          'generateDefaultEventQuery',
          'generateDefaultEventQueries',
        ],
        [
          QueryType.Recording as const,
          'generateDefaultRecordingQuery',
          'generateDefaultRecordingQueries',
        ],
        [
          QueryType.RecordingSegments as const,
          'generateDefaultRecordingSegmentsQuery',
          'generateDefaultRecordingSegmentsQueries',
        ],
        [
          QueryType.Review as const,
          'generateDefaultReviewQuery',
          'generateDefaultReviewQueries',
        ],
      ])(
        'basic %s',
        async (
          queryType: string,
          engineMethodName: string,
          managerMethodName: string,
        ) => {
          const api = createCardAPI();
          vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

          const engine = mock<CameraManagerEngine>();
          const manager = createCameraManager(api, engine);
          expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

          const queries = [{ type: queryType, cameraIDs: new Set(['id']) }];
          engine[engineMethodName].mockReturnValue(queries);
          expect(manager[managerMethodName]('id')).toEqual(queries);
        },
      );

      it('without camera', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api, mock<CameraManagerEngine>());

        expect(manager.generateDefaultEventQueries('not_a_camera')).toBeNull();
      });

      it('without queries', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const engine = mock<CameraManagerEngine>();
        const manager = createCameraManager(api, engine);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

        engine.generateDefaultEventQuery.mockReturnValue(null);
        expect(manager.generateDefaultEventQueries('id')).toBeNull();
      });
    });

    describe('getDefaultQueryParameters', () => {
      it('should return empty object for non-existent camera', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api, mock<CameraManagerEngine>());

        expect(
          manager.getDefaultQueryParameters('not_a_camera', QueryType.Event),
        ).toEqual({});
      });

      it('should return parameters from engine for existing camera', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const engine = mock<CameraManagerEngine>();
        const manager = createCameraManager(api, engine);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
      const manager = createCameraManager(api, engine, [
        {
          config: createCameraConfig({
            ...baseCameraConfig,
            triggers: {
              events: ['snapshots'],
            },
          }),
        },
      ]);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
      expect(manager.getStore().getCamera('id')?.getConfig().triggers.events).toEqual([
        'snapshots',
      ]);
    });
  });

  describe('should get media metadata', () => {
    const query = {
      type: QueryType.MediaMetadata as const,
      cameraIDs: new Set('id'),
    };

    it('with nothing', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
        const manager = createCameraManager(api, engine);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
    it('without hass', async () => {
      const manager = createCameraManager(createCardAPI());
      expect(await manager.getEvents(baseEventQuery)).toEqual(new Map());
    });

    it('without cameras', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = createCameraManager(api);
      expect(await manager.getEvents(baseEventQuery)).toEqual(new Map());
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const engineOptions = {};
      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);
      expect(await manager.getEvents(baseEventQuery, engineOptions)).toEqual(results);
      expect(engine.getEvents).toBeCalledWith(
        hass,
        expect.anything(),
        baseEventQuery,
        engineOptions,
      );
    });
  });

  describe('should review media', () => {
    it('without camera', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = createCameraManager(api);
      const media = new TestViewMedia();

      await manager.reviewMedia(media, true);
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
      const media = new TestViewMedia({ cameraID: 'id' });

      await manager.reviewMedia(media, true);

      expect(engine.reviewMedia).toBeCalledWith(hass, expect.anything(), media, true);
    });
  });

  describe('should get recordings', () => {
    it('successfully', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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

    it('successfully', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const engineOptions = {};
      const results = new Map([[query, queryResults]]);
      engine.getRecordingSegments.mockResolvedValue(results);
      expect(await manager.getRecordingSegments(query, engineOptions)).toEqual(results);
    });
  });

  describe('should execute media queries', () => {
    it('events', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);
      const media = sortItems(generateViewMediaArray({ count: 5 }));
      engine.generateMediaFromEvents.mockReturnValue(media);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual(media);
    });

    it('no converted media', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);
      engine.generateMediaFromEvents.mockReturnValue(null);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual([]);
    });

    it('without matching camera engine during conversion', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const results = new Map([
        [baseEventQuery, { ...baseEventQueryResults, engine: Engine.MotionEye }],
      ]);
      engine.getEvents.mockResolvedValue(results);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual([]);
    });

    it('recordings', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(api, engine);
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const results = new Map([[baseRecordingQuery, baseRecordingQueryResults]]);
      engine.getRecordings.mockResolvedValue(results);
      const media = sortItems(generateViewMediaArray({ count: 5 }));
      engine.generateMediaFromRecordings.mockReturnValue(media);

      expect(await manager.executeMediaQueries([baseRecordingQuery])).toEqual(media);
    });

    it('without hass', async () => {
      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(createCardAPI(), engine);
      const results = new Map([[baseEventQuery, baseEventQueryResults]]);
      engine.getEvents.mockResolvedValue(results);

      expect(await manager.executeMediaQueries([baseEventQuery])).toEqual([]);
    });

    describe('should merge compatible queries', () => {
      it('merges queries with identical properties', async () => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api, engine, [
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam1' }) },
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam2' }) },
        ]);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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

      it('does not merge queries with different properties', async () => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api, engine, [
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam1' }) },
          { config: createCameraConfig({ ...baseCameraConfig, id: 'cam2' }) },
        ]);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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

      it('handles single query without merging', async () => {
        const api = createCardAPI();
        const engine = mock<CameraManagerEngine>();
        vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

        const manager = createCameraManager(api, engine);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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

    it('without hass', async () => {
      const engine = mock<CameraManagerEngine>();
      vi.mocked(engine.getEngineType).mockReturnValue(Engine.Generic);

      const manager = createCameraManager(createCardAPI(), engine);
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

        const manager = createCameraManager(api, engine);
        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
    it('without camera', async () => {
      const manager = createCameraManager(createCardAPI());
      expect(await manager.getMediaDownloadPath(new TestViewMedia())).toBeNull();
    });

    it('without hass', async () => {
      const api = createCardAPI();
      const manager = createCameraManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
      expect(await manager.getMediaDownloadPath(new TestViewMedia())).toBeNull();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);

      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
    it('without camera', async () => {
      const manager = createCameraManager(createCardAPI());
      expect(manager.getMediaCapabilities(new TestViewMedia())).toBeNull();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
    it('without camera', async () => {
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(createCardAPI(), engine);
      manager.favoriteMedia(new TestViewMedia(), true);

      expect(engine.favoriteMedia).not.toBeCalled();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      const media = new TestViewMedia({ cameraID: 'id' });
      manager.favoriteMedia(media, true);
      expect(engine.favoriteMedia).toBeCalledWith(hass, expect.anything(), media, true);
    });
  });

  describe('should get camera endpoints', () => {
    it('without camera', () => {
      const manager = createCameraManager(createCardAPI());
      expect(manager.getCameraEndpoints('BAD')).toBeNull();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      expect(manager.getCameraEndpoints('id', { view: 'live' })).toBeDefined();
    });
  });

  describe('should get camera metadata', () => {
    it('without camera', () => {
      const manager = createCameraManager(createCardAPI());
      expect(manager.getCameraMetadata('BAD')).toBeNull();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
    it('without camera', () => {
      const manager = createCameraManager(createCardAPI());
      expect(manager.getCameraCapabilities('BAD')).toBeNull();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(api, engine);

      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
      expect(manager.getCameraCapabilities('id')).toEqual(createCapabilities());
    });
  });

  describe('should get aggregate camera capabilities', () => {
    it('without camera', () => {
      const manager = createCameraManager(createCardAPI());
      const capabilities = manager.getAggregateCameraCapabilities();

      expect(capabilities.has('favorite-events')).toBeFalsy();
      expect(capabilities.has('favorite-recordings')).toBeFalsy();
      expect(capabilities.has('seek')).toBeFalsy();

      expect(capabilities.has('live')).toBeFalsy();
      expect(capabilities.has('clips')).toBeFalsy();
      expect(capabilities.has('recordings')).toBeFalsy();
      expect(capabilities.has('snapshots')).toBeFalsy();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const manager = createCameraManager(api, mock<CameraManagerEngine>(), [
        {
          capabilties: new Capabilities({
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
          capabilties: new Capabilities({
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
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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
    it('without camera', () => {
      const engine = mock<CameraManagerEngine>();
      const manager = createCameraManager(createCardAPI(), engine);

      manager.executePTZAction('id', 'left', {});

      // No visible action.
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      const action = {
        action: 'perform-action' as const,
        perform_action: 'action',
      };
      const manager = createCameraManager(api, engine, [
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
      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

      manager.executePTZAction('another', 'left');

      expect(api.getActionsManager().executeActions).toBeCalledWith({ actions: action });
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

          const manager = createCameraManager(api, engine, [
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
          expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

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

          expect(api.getActionsManager().executeActions).toBeCalledWith({
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
        const manager = createCameraManager(api, engine);

        expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

        engine.getQueryResultMaxAge.mockReturnValue(60);
        expect(manager.areMediaQueriesResultsFresh(resultsTimestamp, queries)).toBe(
          expectedFresh,
        );
      },
    );

    it('should always return false for null queries', () => {
      const manager = createCameraManager(createCardAPI(), mock<CameraManagerEngine>());
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
          const manager = createCameraManager(api, engine);

          expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

          expect(
            await manager.getMediaSeekTime(
              new TestViewMedia({ startTime: start, endTime: end }),
              target,
            ),
          ).toBeNull();
        },
      );
    });

    it('successfully', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = createCameraManager(api, engine);

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
      engine.getMediaSeekTime.mockResolvedValue(42);

      const media = new TestViewMedia({
        cameraID: 'id',
        startTime: startTime,
        endTime: endTime,
      });
      expect(await manager.getMediaSeekTime(media, middleTime)).toBe(42);

      expect(engine.getMediaSeekTime).toBeCalledWith(
        expect.anything(),
        expect.anything(),
        media,
        middleTime,
      );
    });

    it('handles null return value', async () => {
      const api = createCardAPI();
      const engine = mock<CameraManagerEngine>();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const manager = createCameraManager(api, engine);

      expect(await manager.initializeCamerasFromConfig()).toBeTruthy();
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
    const manager = createCameraManager(api, engine);

    expect(await manager.initializeCamerasFromConfig()).toBeTruthy();

    expect(manager.getStore().getCameraCount()).toBe(1);

    await manager.destroy();

    expect(manager.getStore().getCameraCount()).toBe(0);
  });
});
