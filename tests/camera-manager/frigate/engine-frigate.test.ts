import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { RecordingSegmentsCache } from '../../../src/camera-manager/cache';
import { Camera } from '../../../src/camera-manager/camera';
import {
  FrigateCameraManagerEngine,
  FrigateQueryResultsClassifier,
} from '../../../src/camera-manager/frigate/engine-frigate';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
  FrigateReviewViewMedia,
  FrigateViewMediaFactory,
} from '../../../src/camera-manager/frigate/media';
import {
  getEvents,
  getEventSummary,
  getPTZInfo,
  getRecordingSegments,
  getRecordingsSummary,
  getReviews,
  retainEvent,
  setReviewsReviewed,
} from '../../../src/camera-manager/frigate/requests';
import {
  FrigateEventQueryResults,
  FrigateRecordingQueryResults,
  FrigateReviewQueryResults,
} from '../../../src/camera-manager/frigate/types';
import {
  CameraManagerRequestCache,
  Engine,
  QueryResultsType,
  QueryType,
} from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { CameraConfig } from '../../../src/config/schema/cameras';
import { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { QuerySource } from '../../../src/query-source';
import { Severity } from '../../../src/severity';
import { ViewMedia, ViewMediaType } from '../../../src/view/item';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import {
  createCameraConfig,
  createFrigateEvent,
  createFrigateRecording,
  createFrigateReview,
  createHASS,
  createStore,
  TestViewMedia,
} from '../../test-utils';

vi.mock('../../../src/camera-manager/frigate/requests');

const createEngine = (options?: {
  cache?: RecordingSegmentsCache;
  requestCache?: CameraManagerRequestCache;
}): FrigateCameraManagerEngine => {
  return new FrigateCameraManagerEngine(
    new EntityRegistryManagerMock(),
    new StateWatcher(),
    options?.cache ?? new RecordingSegmentsCache(),
    options?.requestCache ?? new CameraManagerRequestCache(),
  );
};

const createRecordingMedia = (): FrigateRecordingViewMedia => {
  return new FrigateRecordingViewMedia(
    ViewMediaType.Recording,
    'camera-1',
    {
      cameraID: 'camera-1',
      startTime: new Date('2026-03-14T20:00:00Z'),
      endTime: new Date('2026-03-14T20:59:59Z'),
      events: 1,
    },
    'recording-id',
    'recording-content-id',
    'recording-title',
  );
};

const createClipMedia = (): FrigateEventViewMedia => {
  return new FrigateEventViewMedia(
    ViewMediaType.Clip,
    'camera-1',
    createFrigateEvent({
      camera: 'camera-1',
      id: 'event-id',
      retain_indefinitely: true,
    }),
    'event-clip-content-id',
    'event-clip-thumbnail',
  );
};

const createSnapshotMedia = (): FrigateEventViewMedia => {
  return new FrigateEventViewMedia(
    ViewMediaType.Snapshot,
    'camera-1',
    createFrigateEvent({
      camera: 'camera-1',
      id: 'event-id',
      retain_indefinitely: true,
    }),
    'event-snapshot-content-id',
    'event-snapshot-thumbnail',
  );
};

const createFrigateCameraConfig = (
  config?: RawAdvancedCameraCardConfig,
): CameraConfig => {
  return createCameraConfig({
    frigate: {
      camera_name: 'camera-1',
      client_id: 'frigate',
    },
    camera_entity: 'camera.office',
    ...config,
  });
};

// @vitest-environment jsdom
describe('FrigateQueryResultsClassifier', () => {
  it('should identify frigate event query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateEventQueryResults({
        type: QueryResultsType.Event,
        engine: Engine.Frigate,
      }),
    ).toBeTruthy();
  });

  it('should reject non-frigate event query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateEventQueryResults({
        type: QueryResultsType.Event,
        engine: Engine.Generic,
      }),
    ).toBeFalsy();
  });

  it('should reject non-event query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateEventQueryResults({
        type: QueryResultsType.Recording,
        engine: Engine.Frigate,
      }),
    ).toBeFalsy();
  });

  it('should identify frigate recording query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateRecordingQueryResults({
        type: QueryResultsType.Recording,
        engine: Engine.Frigate,
      }),
    ).toBeTruthy();
  });

  it('should reject non-frigate recording query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateRecordingQueryResults({
        type: QueryResultsType.Recording,
        engine: Engine.Generic,
      }),
    ).toBeFalsy();
  });

  it('should identify frigate recording segments results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateRecordingSegmentsResults({
        type: QueryResultsType.RecordingSegments,
        engine: Engine.Frigate,
      }),
    ).toBeTruthy();
  });

  it('should reject non-frigate recording segments results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateRecordingSegmentsResults({
        type: QueryResultsType.RecordingSegments,
        engine: Engine.Generic,
      }),
    ).toBeFalsy();
  });

  it('should identify frigate review query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateReviewQueryResults({
        type: QueryResultsType.Review,
        engine: Engine.Frigate,
      }),
    ).toBeTruthy();
  });

  it('should reject non-frigate review query results', () => {
    expect(
      FrigateQueryResultsClassifier.isFrigateReviewQueryResults({
        type: QueryResultsType.Review,
        engine: Engine.Generic,
      }),
    ).toBeFalsy();
  });
});

describe('FrigateCameraManagerEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEngineType', () => {
    it('should return Frigate engine type', () => {
      expect(createEngine().getEngineType()).toBe(Engine.Frigate);
    });
  });

  describe('createCamera', () => {
    it('should create a FrigateCamera', async () => {
      const engine = createEngine();
      vi.mocked(getPTZInfo).mockResolvedValue({ features: [], presets: [] });

      const camera = await engine.createCamera(
        createHASS(),
        createFrigateCameraConfig(),
      );

      expect(camera).toBeInstanceOf(Camera);
    });
  });

  describe('getDefaultQueryParameters', () => {
    it('should return labels and zones for event queries', () => {
      const engine = createEngine();
      const config = createCameraConfig({
        frigate: {
          camera_name: 'camera-1',
          labels: ['person', 'car'],
          zones: ['front_yard'],
        },
      });
      const store = createStore([{ cameraID: 'camera-1', config, engine }]);
      const camera = store.getCamera('camera-1');
      assert(camera);

      const params = engine.getDefaultQueryParameters(camera, QueryType.Event);

      expect(params).toEqual({
        what: new Set(['person', 'car']),
        where: new Set(['front_yard']),
      });
    });

    it('should return labels and zones for review queries', () => {
      const engine = createEngine();
      const config = createCameraConfig({
        frigate: {
          camera_name: 'camera-1',
          labels: ['person'],
          zones: ['backyard'],
        },
      });
      const store = createStore([{ cameraID: 'camera-1', config, engine }]);
      const camera = store.getCamera('camera-1');
      assert(camera);

      const params = engine.getDefaultQueryParameters(camera, QueryType.Review);

      expect(params).toEqual({
        what: new Set(['person']),
        where: new Set(['backyard']),
      });
    });

    it('should return empty for recording queries', () => {
      const engine = createEngine();
      const config = createCameraConfig({
        frigate: {
          camera_name: 'camera-1',
          labels: ['person'],
        },
      });
      const store = createStore([{ cameraID: 'camera-1', config, engine }]);
      const camera = store.getCamera('camera-1');
      assert(camera);

      const params = engine.getDefaultQueryParameters(camera, QueryType.Recording);

      expect(params).toEqual({});
    });

    it('should return empty when no labels or zones', () => {
      const engine = createEngine();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config, engine }]);
      const camera = store.getCamera('camera-1');
      assert(camera);

      const params = engine.getDefaultQueryParameters(camera, QueryType.Event);

      expect(params).toEqual({});
    });
  });

  describe('getMediaDownloadPath', () => {
    it('should get event with clip download path', async () => {
      const endpoint = await createEngine().getMediaDownloadPath(
        createHASS(),
        createFrigateCameraConfig(),
        createClipMedia(),
      );

      expect(endpoint).toEqual({
        endpoint: '/api/frigate/frigate/notifications/event-id/clip.mp4?download=true',
        sign: true,
      });
    });

    it('should get event with snapshot download path', async () => {
      const endpoint = await createEngine().getMediaDownloadPath(
        createHASS(),
        createFrigateCameraConfig(),
        createSnapshotMedia(),
      );

      expect(endpoint).toEqual({
        endpoint:
          '/api/frigate/frigate/notifications/event-id/snapshot.jpg?download=true',
        sign: true,
      });
    });

    it('should get recording download path', async () => {
      const endpoint = await createEngine().getMediaDownloadPath(
        createHASS(),
        createFrigateCameraConfig(),
        createRecordingMedia(),
      );

      expect(endpoint).toEqual({
        endpoint:
          '/api/frigate/frigate/recording/camera-1/start/1773518400/end/1773521999?download=true',
        sign: true,
      });
    });

    it('should get no path for unknown type', async () => {
      const endpoint = await createEngine().getMediaDownloadPath(
        createHASS(),
        createFrigateCameraConfig(),
        new ViewMedia(ViewMediaType.Clip, {
          cameraID: 'camera-1',
        }),
      );
      expect(endpoint).toBeNull();
    });

    it('should get no path when client_id is unresolved', async () => {
      const endpoint = await createEngine().getMediaDownloadPath(
        createHASS(),
        createFrigateCameraConfig({
          frigate: { camera_name: 'camera-1' },
        }),
        createClipMedia(),
      );
      expect(endpoint).toBeNull();
    });
  });

  describe('generateDefaultEventQuery', () => {
    it('should batch cameras with same config', () => {
      const engine = createEngine();
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', labels: ['person'] },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2', labels: ['person'] },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
      ]);

      const queries = engine.generateDefaultEventQuery(
        store,
        new Set(['camera-1', 'camera-2']),
      );

      expect(queries).toHaveLength(1);
      assert(queries);
      expect(queries[0].cameraIDs).toEqual(new Set(['camera-1', 'camera-2']));
      expect(queries[0].what).toEqual(new Set(['person']));
    });

    it('should fan out cameras with different configs', () => {
      const engine = createEngine();
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', labels: ['person'] },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2', labels: ['car'] },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
      ]);

      const queries = engine.generateDefaultEventQuery(
        store,
        new Set(['camera-1', 'camera-2']),
      );

      expect(queries).toHaveLength(2);
    });

    it('should fan out cameras with different zones', () => {
      const engine = createEngine();
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', zones: ['front'] },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2', zones: ['back'] },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
      ]);

      const queries = engine.generateDefaultEventQuery(
        store,
        new Set(['camera-1', 'camera-2']),
      );

      expect(queries).toHaveLength(2);
      assert(queries);
      expect(queries[0].where).toEqual(new Set(['front']));
      expect(queries[1].where).toEqual(new Set(['back']));
    });

    it('should return null when no cameras produce queries', () => {
      const engine = createEngine();
      const store = createStore();

      const queries = engine.generateDefaultEventQuery(
        store,
        new Set(['camera-nonexistent']),
      );

      expect(queries).toBeNull();
    });

    it('should include partial query overrides', () => {
      const engine = createEngine();
      const config = createCameraConfig({
        frigate: { camera_name: 'cam1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const start = new Date('2026-03-14');
      const end = new Date('2026-03-15');

      const queries = engine.generateDefaultEventQuery(store, new Set(['camera-1']), {
        start,
        end,
        limit: 10,
      });

      assert(queries);
      expect(queries[0].start).toEqual(start);
      expect(queries[0].end).toEqual(end);
      expect(queries[0].limit).toBe(10);
    });

    it('should batch cameras with shared zones in event query', () => {
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', zones: ['front'] },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2', zones: ['front'] },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
      ]);

      const queries = createEngine().generateDefaultEventQuery(
        store,
        new Set(['camera-1', 'camera-2']),
      );

      assert(queries);
      expect(queries).toHaveLength(1);
      expect(queries[0].where).toEqual(new Set(['front']));
    });
  });

  describe('generateDefaultRecordingQuery', () => {
    it('should generate recording query', () => {
      const engine = createEngine();
      const store = createStore();

      const queries = engine.generateDefaultRecordingQuery(store, new Set(['camera-1']));

      expect(queries).toHaveLength(1);
      expect(queries[0].type).toBe(QueryType.Recording);
      expect(queries[0].cameraIDs).toEqual(new Set(['camera-1']));
    });

    it('should include partial query overrides', () => {
      const engine = createEngine();
      const store = createStore();
      const start = new Date('2026-03-14');

      const queries = engine.generateDefaultRecordingQuery(
        store,
        new Set(['camera-1']),
        { start },
      );

      expect(queries[0].start).toEqual(start);
    });
  });

  describe('generateDefaultRecordingSegmentsQuery', () => {
    it('should generate segments query with start and end', () => {
      const engine = createEngine();
      const store = createStore();
      const start = new Date('2023-01-01T00:00:00Z');
      const end = new Date('2023-01-01T01:00:00Z');

      const queries = engine.generateDefaultRecordingSegmentsQuery(
        store,
        new Set(['camera-1']),
        { start, end },
      );

      assert(queries);
      expect(queries).toHaveLength(1);
      expect(queries[0].start).toEqual(start);
      expect(queries[0].end).toEqual(end);
    });

    it('should return null without start', () => {
      const engine = createEngine();
      const store = createStore();

      const queries = engine.generateDefaultRecordingSegmentsQuery(
        store,
        new Set(['camera-1']),
        { end: new Date() },
      );

      expect(queries).toBeNull();
    });

    it('should return null without end', () => {
      const engine = createEngine();
      const store = createStore();

      const queries = engine.generateDefaultRecordingSegmentsQuery(
        store,
        new Set(['camera-1']),
        { start: new Date() },
      );

      expect(queries).toBeNull();
    });
  });

  describe('generateDefaultReviewQuery', () => {
    it('should batch cameras with same config', () => {
      const engine = createEngine();
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1' },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2' },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
      ]);

      const queries = engine.generateDefaultReviewQuery(
        store,
        new Set(['camera-1', 'camera-2']),
      );

      expect(queries).toHaveLength(1);
    });
  });

  describe('favoriteMedia', () => {
    it('should retain a frigate event', async () => {
      const hass = createHASS();
      const media = createClipMedia();
      vi.mocked(retainEvent).mockResolvedValue();

      await createEngine().favoriteMedia(hass, createFrigateCameraConfig(), media, true);

      expect(retainEvent).toHaveBeenCalledWith(hass, 'frigate', 'event-id', true);
      expect(media.isFavorite()).toBe(true);
    });

    it('should unretain a frigate event', async () => {
      const hass = createHASS();
      vi.mocked(retainEvent).mockResolvedValue();

      await createEngine().favoriteMedia(
        hass,
        createFrigateCameraConfig(),
        createClipMedia(),
        false,
      );

      expect(retainEvent).toHaveBeenCalledWith(hass, 'frigate', 'event-id', false);
    });

    it('should do nothing for non-frigate event media', async () => {
      const media = new ViewMedia(ViewMediaType.Clip, { cameraID: 'camera-1' });

      await createEngine().favoriteMedia(
        createHASS(),
        createFrigateCameraConfig(),
        media,
        true,
      );

      expect(retainEvent).not.toHaveBeenCalled();
    });
  });

  describe('reviewMedia', () => {
    it('should mark a frigate review as reviewed', async () => {
      const hass = createHASS();
      const media = new FrigateReviewViewMedia(
        'camera-1',
        createFrigateReview(),
        'content-id',
        'thumb',
      );
      vi.mocked(setReviewsReviewed).mockResolvedValue();

      await createEngine().reviewMedia(hass, createFrigateCameraConfig(), media, true);

      expect(setReviewsReviewed).toHaveBeenCalledWith(
        hass,
        'frigate',
        ['review_id'],
        true,
      );
    });

    it('should do nothing for non-frigate review media', async () => {
      const media = new ViewMedia(ViewMediaType.Review, { cameraID: 'camera-1' });

      await createEngine().reviewMedia(
        createHASS(),
        createFrigateCameraConfig(),
        media,
        true,
      );

      expect(setReviewsReviewed).not.toHaveBeenCalled();
    });
  });

  describe('getEvents', () => {
    it('should return null for unsupported filters', async () => {
      const result = await createEngine().getEvents(createHASS(), createStore(), {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        reviewed: true,
      });

      expect(result).toBeNull();
    });

    it('should fetch events successfully', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({ camera: 'camera-1' });
      vi.mocked(getEvents).mockResolvedValue([event]);

      const result = await createEngine().getEvents(createHASS(), store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      expect(result.size).toBe(1);
      const queryResult = [...result.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateEventQueryResults(queryResult));
      expect(queryResult.events).toEqual([event]);
      expect(queryResult.cached).toBe(false);
    });

    it('should pass query parameters to native query', async () => {
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const start = new Date('2023-01-01T00:00:00Z');
      const end = new Date('2023-01-02T00:00:00Z');
      vi.mocked(getEvents).mockResolvedValue([]);

      await createEngine().getEvents(hass, store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        what: new Set(['person']),
        where: new Set(['front_yard']),
        tags: new Set(['john']),
        start,
        end,
        limit: 5,
        hasClip: true,
        hasSnapshot: true,
        favorite: true,
      });

      expect(getEvents).toHaveBeenCalledWith(hass, {
        instance_id: 'client-1',
        cameras: ['camera-1'],
        labels: ['person'],
        zones: ['front_yard'],
        sub_labels: ['john'],
        after: Math.floor(start.getTime() / 1000),
        before: Math.floor(end.getTime() / 1000),
        limit: 5,
        has_clip: true,
        has_snapshot: true,
        favorites: true,
      });
    });

    it('should use cache when available', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({ camera: 'camera-1' });

      vi.mocked(getEvents).mockResolvedValue([event]);

      // First call populates cache.
      await engine.getEvents(hass, store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      // Second call should use cache.
      const result = await engine.getEvents(hass, store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getEvents).toHaveBeenCalledTimes(1);
      assert(result);
      const queryResult = [...result.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateEventQueryResults(queryResult));
      expect(queryResult.cached).toBe(true);
    });

    it('should skip cache when useCache is false', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEvents).mockResolvedValue([]);

      await engine.getEvents(hass, store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      await engine.getEvents(
        hass,
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        { useCache: false },
      );

      expect(getEvents).toHaveBeenCalledTimes(2);
    });

    it('should return null when no cameras map to instances', async () => {
      // Birdseye cameras are excluded from queries.
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const result = await createEngine().getEvents(createHASS(), store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(result).toBeNull();
    });

    it('should group cameras by instance', async () => {
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', client_id: 'instance-1' },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2', client_id: 'instance-1' },
      });
      const config3 = createCameraConfig({
        frigate: { camera_name: 'cam3', client_id: 'instance-2' },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
        { cameraID: 'camera-3', config: config3 },
      ]);

      vi.mocked(getEvents).mockResolvedValue([]);

      await createEngine().getEvents(createHASS(), store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1', 'camera-2', 'camera-3']),
      });

      // Two calls: one per Frigate instance.
      expect(getEvents).toHaveBeenCalledTimes(2);
    });

    it('should send empty cameras list when camera_name is empty', async () => {
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: '', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEvents).mockResolvedValue([]);

      const result = await createEngine().getEvents(hass, store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      // Event query still runs but with no cameras filter.
      expect(getEvents).toHaveBeenCalledWith(
        hass,
        expect.objectContaining({ cameras: [] }),
      );
    });

    it('should skip event cache write when useCache is false', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEvents).mockResolvedValue([]);

      await engine.getEvents(
        hass,
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        { useCache: false },
      );

      await engine.getEvents(hass, store, {
        type: QueryType.Event,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('getReviews', () => {
    it('should return null for unsupported filters', async () => {
      const result = await createEngine().getReviews(createHASS(), createStore(), {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        favorite: true,
      });

      expect(result).toBeNull();
    });

    it('should fan out requests for multiple severities', async () => {
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const reviewHigh = createFrigateReview({ id: 'review-high' });
      const reviewMedium = createFrigateReview({ id: 'review-medium' });

      vi.mocked(getReviews)
        .mockResolvedValueOnce([reviewHigh])
        .mockResolvedValueOnce([reviewMedium]);

      const resultsMap = await createEngine().getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        severity: new Set<Severity>(['high', 'medium']),
      });

      expect(getReviews).toHaveBeenCalledTimes(2);
      expect(getReviews).toHaveBeenCalledWith(
        hass,
        expect.objectContaining({ severity: 'alert' }),
      );
      expect(getReviews).toHaveBeenCalledWith(
        hass,
        expect.objectContaining({ severity: 'detection' }),
      );

      assert(resultsMap);
      const result = [...resultsMap.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateReviewQueryResults(result));
      expect(result.reviews).toHaveLength(2);
    });

    it('should handle single severity', async () => {
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getReviews).mockResolvedValue([]);

      await createEngine().getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        severity: new Set<Severity>(['high']),
      });

      expect(getReviews).toHaveBeenCalledTimes(1);
      expect(getReviews).toHaveBeenCalledWith(
        hass,
        expect.objectContaining({ severity: 'alert' }),
      );
    });

    it('should ignore low severity', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getReviews).mockResolvedValue([]);

      await createEngine().getReviews(createHASS(), store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        severity: new Set<Severity>(['low']),
      });

      expect(getReviews).not.toHaveBeenCalled();
    });

    it('should query all valid severities when severity is undefined', async () => {
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getReviews).mockResolvedValue([]);

      await createEngine().getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        severity: undefined,
      });

      expect(getReviews).toHaveBeenCalledTimes(1);
      expect(getReviews).toHaveBeenCalledWith(
        hass,
        expect.objectContaining({ severity: undefined }),
      );
    });

    it('should use cache when available', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getReviews).mockResolvedValue([]);

      await engine.getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      await engine.getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getReviews).toHaveBeenCalledTimes(1);
    });

    it('should pass query parameters to review request', async () => {
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const start = new Date('2023-01-01T00:00:00Z');
      const end = new Date('2023-01-02T00:00:00Z');

      vi.mocked(getReviews).mockResolvedValue([]);

      await createEngine().getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        what: new Set(['person']),
        where: new Set(['zone1']),
        start,
        end,
        limit: 5,
        reviewed: false,
        severity: new Set<Severity>(['high']),
      });

      expect(getReviews).toHaveBeenCalledWith(hass, {
        instance_id: 'client-1',
        cameras: ['camera-1'],
        labels: ['person'],
        zones: ['zone1'],
        after: Math.floor(start.getTime() / 1000),
        before: Math.floor(end.getTime() / 1000),
        limit: 5,
        severity: 'alert',
        reviewed: false,
      });
    });

    it('should return null when no cameras map to instances', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const result = await createEngine().getReviews(createHASS(), store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(result).toBeNull();
    });

    it('should skip review cache write when useCache is false', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getReviews).mockResolvedValue([]);

      await engine.getReviews(
        hass,
        store,
        {
          type: QueryType.Review,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        { useCache: false },
      );

      // Second call should still hit the API since cache was not populated.
      await engine.getReviews(hass, store, {
        type: QueryType.Review,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getReviews).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRecordings', () => {
    it('should return null for unsupported filters', async () => {
      const result = await createEngine().getRecordings(createHASS(), createStore(), {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        what: new Set(['person']),
      });

      expect(result).toBeNull();
    });

    it('should fetch recordings successfully', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getRecordingsSummary).mockResolvedValue([
        {
          day: new Date('2026-03-14'),
          events: 5,
          hours: [{ hour: 20, duration: 3600, events: 5 }],
        },
      ]);

      const result = await createEngine().getRecordings(createHASS(), store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      expect(result.size).toBe(1);
      const queryResult = [...result.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(queryResult));
      expect(queryResult.recordings).toHaveLength(1);
      expect(queryResult.recordings[0].events).toBe(5);
    });

    it('should filter recordings by date range', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      // Use a fixed local-timezone day to avoid UTC/local mismatch.
      const day = new Date(2026, 2, 14, 0, 0, 0);

      vi.mocked(getRecordingsSummary).mockResolvedValue([
        {
          day: day,
          events: 10,
          hours: [
            { hour: 10, duration: 3600, events: 3 },
            { hour: 14, duration: 3600, events: 4 },
            { hour: 20, duration: 3600, events: 3 },
          ],
        },
      ]);

      const result = await createEngine().getRecordings(createHASS(), store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        start: new Date(2026, 2, 14, 12, 0, 0),
        end: new Date(2026, 2, 14, 18, 0, 0),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(queryResult));

      // Only the hour 14 recording falls within 12:00-18:00.
      expect(queryResult.recordings).toHaveLength(1);
      expect(queryResult.recordings[0].events).toBe(4);
    });

    it('should limit recordings', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getRecordingsSummary).mockResolvedValue([
        {
          day: new Date('2026-03-14'),
          events: 6,
          hours: [
            { hour: 10, duration: 3600, events: 2 },
            { hour: 14, duration: 3600, events: 2 },
            { hour: 20, duration: 3600, events: 2 },
          ],
        },
      ]);

      const result = await createEngine().getRecordings(createHASS(), store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
        limit: 2,
      });

      assert(result);
      const queryResult = [...result.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(queryResult));
      expect(queryResult.recordings).toHaveLength(2);
    });

    it('should use cache when available', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      await engine.getRecordings(hass, store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      await engine.getRecordings(hass, store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getRecordingsSummary).toHaveBeenCalledTimes(1);
    });

    it('should skip birdseye cameras', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const result = await createEngine().getRecordings(createHASS(), store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(result).toBeNull();
      expect(getRecordingsSummary).not.toHaveBeenCalled();
    });

    it('should skip cameras without camera_name', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: '' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const result = await createEngine().getRecordings(createHASS(), store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(result).toBeNull();
    });

    it('should handle null recording summary', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getRecordingsSummary).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof getRecordingsSummary>>,
      );

      const result = await createEngine().getRecordings(createHASS(), store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      assert(FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(queryResult));
      expect(queryResult.recordings).toHaveLength(0);
    });

    it('should skip recording cache write when useCache is false', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      await engine.getRecordings(
        hass,
        store,
        {
          type: QueryType.Recording,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        { useCache: false },
      );

      // Second call should still hit the API since cache was not populated.
      await engine.getRecordings(hass, store, {
        type: QueryType.Recording,
        source: QuerySource.Camera,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getRecordingsSummary).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRecordingSegments', () => {
    it('should fetch segments successfully', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const segments = [{ start_time: 100, end_time: 200, id: 'seg-1' }];
      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      const start = new Date('2026-03-14T20:00:00Z');
      const end = new Date('2026-03-14T21:00:00Z');

      const result = await createEngine().getRecordingSegments(createHASS(), store, {
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera-1']),
        start,
        end,
      });

      assert(result);
      expect(result.size).toBe(1);
      const queryResult = [...result.values()][0];
      assert(
        FrigateQueryResultsClassifier.isFrigateRecordingSegmentsResults(queryResult),
      );
      expect(queryResult.segments).toEqual(segments);
      expect(queryResult.cached).toBe(false);
    });

    it('should use segment cache when available', async () => {
      const cache = new RecordingSegmentsCache();
      const engine = createEngine({ cache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const start = new Date('2026-03-14T20:00:00Z');
      const end = new Date('2026-03-14T21:00:00Z');
      const segments = [{ start_time: 100, end_time: 200, id: 'seg-1' }];

      cache.add('camera-1', { start, end }, segments);

      const result = await engine.getRecordingSegments(hass, store, {
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera-1']),
        start,
        end,
      });

      expect(getRecordingSegments).not.toHaveBeenCalled();
      assert(result);
      const queryResult = [...result.values()][0];
      assert(
        FrigateQueryResultsClassifier.isFrigateRecordingSegmentsResults(queryResult),
      );
      expect(queryResult.cached).toBe(true);
    });

    it('should skip birdseye cameras', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const result = await createEngine().getRecordingSegments(createHASS(), store, {
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera-1']),
        start: new Date(),
        end: new Date(),
      });

      expect(result).toBeNull();
    });

    it('should skip cameras without camera_name', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: '' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const result = await createEngine().getRecordingSegments(createHASS(), store, {
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera-1']),
        start: new Date(),
        end: new Date(),
      });

      expect(result).toBeNull();
    });

    it('should skip segment cache when useCache is false', async () => {
      const cache = new RecordingSegmentsCache();
      const engine = createEngine({ cache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const start = new Date('2026-03-14T20:00:00Z');
      const end = new Date('2026-03-14T21:00:00Z');
      const segments = [{ start_time: 100, end_time: 200, id: 'seg-1' }];

      cache.add('camera-1', { start, end }, segments);

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      await engine.getRecordingSegments(
        hass,
        store,
        {
          type: QueryType.RecordingSegments,
          cameraIDs: new Set(['camera-1']),
          start,
          end,
        },
        { useCache: false },
      );

      expect(getRecordingSegments).toHaveBeenCalled();
    });
  });

  describe('generateMediaFromEvents', () => {
    it('should return null for non-frigate results', () => {
      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        createStore(),
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Generic,
        },
      );

      expect(result).toBeNull();
    });

    it('should generate clip media from events', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
        has_snapshot: false,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(FrigateEventViewMedia);
      expect(result[0].getMediaType()).toBe(ViewMediaType.Clip);
    });

    it('should generate snapshot media when only snapshot available', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: false,
        has_snapshot: true,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0].getMediaType()).toBe(ViewMediaType.Snapshot);
    });

    it('should respect hasSnapshot query filter', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
        has_snapshot: true,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
          hasSnapshot: true,
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0].getMediaType()).toBe(ViewMediaType.Snapshot);
    });

    it('should respect hasClip query filter', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
        has_snapshot: true,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
          hasClip: true,
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0].getMediaType()).toBe(ViewMediaType.Clip);
    });

    it('should skip events without matching media type', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: false,
        has_snapshot: false,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should skip events with hasSnapshot but no snapshot', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
        has_snapshot: false,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
          hasSnapshot: true,
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should handle sub_labels on events', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
        sub_label: 'john, jane',
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      assert(result[0] instanceof FrigateEventViewMedia);
      expect(result[0].getTags()).toEqual(['john', 'jane']);
    });

    it('should skip events for birdseye cameras', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should match camera by instance and name for multi-camera queries', () => {
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', client_id: 'client-1' },
      });
      const config2 = createCameraConfig({
        frigate: { camera_name: 'cam2', client_id: 'client-1' },
      });
      const store = createStore([
        { cameraID: 'camera-1', config: config1 },
        { cameraID: 'camera-2', config: config2 },
      ]);
      const event = createFrigateEvent({
        camera: 'cam2',
        has_clip: true,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1', 'camera-2']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0].getCameraID()).toBe('camera-2');
    });

    it('should skip events with no matching camera', () => {
      const config1 = createCameraConfig({
        frigate: { camera_name: 'cam1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config: config1 }]);
      const event = createFrigateEvent({
        camera: 'unknown-cam',
        has_clip: true,
      });

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1', 'camera-2']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should skip events when factory returns null', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const event = createFrigateEvent({
        camera: 'camera-1',
        has_clip: true,
      });

      vi.spyOn(FrigateViewMediaFactory, 'createEventViewMedia').mockReturnValue(null);

      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          events: [event],
        } as FrigateEventQueryResults,
      );

      expect(result).toEqual([]);
    });
  });

  describe('generateMediaFromRecordings', () => {
    it('should return null for non-frigate results', () => {
      const result = createEngine().generateMediaFromRecordings(
        createHASS(),
        createStore(),
        {
          type: QueryType.Recording,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Recording,
          engine: Engine.Generic,
        },
      );

      expect(result).toBeNull();
    });

    it('should generate media from recordings', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
        camera_entity: 'camera.office',
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const recording = createFrigateRecording({
        cameraID: 'camera-1',
      });

      const result = createEngine().generateMediaFromRecordings(
        createHASS(),
        store,
        {
          type: QueryType.Recording,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Recording,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          recordings: [recording],
        } as FrigateRecordingQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(FrigateRecordingViewMedia);
    });

    it('should skip birdseye camera recordings', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const recording = createFrigateRecording({
        cameraID: 'camera-1',
      });

      const result = createEngine().generateMediaFromRecordings(
        createHASS(),
        store,
        {
          type: QueryType.Recording,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Recording,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          recordings: [recording],
        } as FrigateRecordingQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should skip recordings when factory returns null', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
        camera_entity: 'camera.office',
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const recording = createFrigateRecording({ cameraID: 'camera-1' });

      vi.spyOn(FrigateViewMediaFactory, 'createRecordingViewMedia').mockReturnValue(
        null,
      );

      const result = createEngine().generateMediaFromRecordings(
        createHASS(),
        store,
        {
          type: QueryType.Recording,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Recording,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          recordings: [recording],
        } as FrigateRecordingQueryResults,
      );

      expect(result).toEqual([]);
    });
  });

  describe('generateMediaFromReviews', () => {
    it('should return null for non-frigate results', () => {
      const result = createEngine().generateMediaFromReviews(
        createHASS(),
        createStore(),
        {
          type: QueryType.Review,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Review,
          engine: Engine.Generic,
        },
      );

      expect(result).toBeNull();
    });

    it('should generate media from reviews', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const review = createFrigateReview({ camera: 'camera-1' });

      const result = createEngine().generateMediaFromReviews(
        createHASS(),
        store,
        {
          type: QueryType.Review,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Review,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          reviews: [review],
        } as FrigateReviewQueryResults,
      );

      assert(result);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(FrigateReviewViewMedia);
    });

    it('should skip reviews for birdseye cameras', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const review = createFrigateReview({ camera: 'camera-1' });

      const result = createEngine().generateMediaFromReviews(
        createHASS(),
        store,
        {
          type: QueryType.Review,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Review,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          reviews: [review],
        } as FrigateReviewQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should skip reviews with no matching camera', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'cam1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const review = createFrigateReview({ camera: 'unknown-cam' });

      const result = createEngine().generateMediaFromReviews(
        createHASS(),
        store,
        {
          type: QueryType.Review,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1', 'camera-2']),
        },
        {
          type: QueryResultsType.Review,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          reviews: [review],
        } as FrigateReviewQueryResults,
      );

      expect(result).toEqual([]);
    });

    it('should skip reviews when factory returns null', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);
      const review = createFrigateReview({ camera: 'camera-1' });

      vi.spyOn(FrigateViewMediaFactory, 'createReviewViewMedia').mockReturnValue(null);

      const result = createEngine().generateMediaFromReviews(
        createHASS(),
        store,
        {
          type: QueryType.Review,
          source: QuerySource.Camera,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Review,
          engine: Engine.Frigate,
          instanceID: 'client-1',
          reviews: [review],
        } as FrigateReviewQueryResults,
      );

      expect(result).toEqual([]);
    });
  });

  describe('getQueryResultMaxAge', () => {
    it('should return 60 for event queries', () => {
      expect(
        createEngine().getQueryResultMaxAge({
          type: QueryType.Event,
          cameraIDs: new Set(),
        }),
      ).toBe(60);
    });

    it('should return 60 for recording queries', () => {
      expect(
        createEngine().getQueryResultMaxAge({
          type: QueryType.Recording,
          cameraIDs: new Set(),
        }),
      ).toBe(60);
    });

    it('should return 60 for review queries', () => {
      expect(
        createEngine().getQueryResultMaxAge({
          type: QueryType.Review,
          cameraIDs: new Set(),
        }),
      ).toBe(60);
    });

    it('should return null for other query types', () => {
      expect(
        createEngine().getQueryResultMaxAge({
          type: QueryType.RecordingSegments,
          cameraIDs: new Set(),
        }),
      ).toBeNull();
    });
  });

  describe('getMediaSeekTime', () => {
    it('should get seek time for review media', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:45:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      const segments = [
        {
          start_time: new Date('2026-03-14T20:00:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T21:00:00Z').getTime() / 1000,
          id: 'segment-1',
        },
      ];

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      const seekTime = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        startTime,
      );

      // 15 minutes into the hour-long recording.
      expect(seekTime).toBe(15 * 60);
    });

    it('should get zero seek time for clip media when seeking to start', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:15:10Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      const segments = [
        {
          start_time: startTime.getTime() / 1000,
          end_time: endTime.getTime() / 1000,
          id: 'segment-1',
        },
      ];

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      const seekTime = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        startTime,
      );

      expect(seekTime).toBe(0);
    });

    it('should return null when media has no start time', async () => {
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
      });

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        createStore(),
        media,
        new Date(),
      );

      expect(result).toBeNull();
    });

    it('should return null when media has no cameraID', async () => {
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        startTime: new Date(),
      });

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        createStore(),
        media,
        new Date(),
      );

      expect(result).toBeNull();
    });

    it('should return null when media has no end time', async () => {
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime: new Date('2026-03-14T20:15:00Z'),
      });

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        createStore(),
        media,
        new Date('2026-03-14T20:20:00Z'),
      );

      expect(result).toBeNull();
    });

    it('should return null when target is before start', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:45:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:00:00Z'),
      );

      expect(result).toBeNull();
    });

    it('should return null when target is after end', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:45:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T21:00:00Z'),
      );

      expect(result).toBeNull();
    });

    it('should return null when no segments found', async () => {
      // Use birdseye so getRecordingSegments returns null.
      const config = createCameraConfig({
        frigate: { camera_name: 'birdseye', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:45:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:20:00Z'),
      );

      expect(result).toBeNull();
    });

    it('should handle empty segments', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:45:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      vi.mocked(getRecordingSegments).mockResolvedValue([]);

      const result = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:20:00Z'),
      );

      expect(result).toBeNull();
    });

    it('should handle multiple segments with gaps', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:00:00Z');
      const endTime = new Date('2026-03-14T20:30:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Recording,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      // Two 10-minute segments with a gap.
      const segments = [
        {
          start_time: new Date('2026-03-14T20:00:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T20:10:00Z').getTime() / 1000,
          id: 'seg-1',
        },
        {
          start_time: new Date('2026-03-14T20:20:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T20:30:00Z').getTime() / 1000,
          id: 'seg-2',
        },
      ];

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      const seekTime = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:25:00Z'),
      );

      // 10 min from first segment + 5 min from second segment = 15 min.
      expect(seekTime).toBe(15 * 60);
    });

    it('should use recording type for seek (hour boundaries)', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:15:00Z');
      const endTime = new Date('2026-03-14T20:45:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Recording,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      const segments = [
        {
          start_time: new Date('2026-03-14T20:00:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T21:00:00Z').getTime() / 1000,
          id: 'segment-1',
        },
      ];

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      // For recording, start is startOfHour(20:15) = 20:00, end = endOfHour = ~21:00.
      const seekTime = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:30:00Z'),
      );

      // 30 minutes from start of hour.
      expect(seekTime).toBe(30 * 60);
    });

    it('should handle segment starting after target in seek', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:00:00Z');
      const endTime = new Date('2026-03-14T20:30:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      // First segment is before target, second starts after target.
      const segments = [
        {
          start_time: new Date('2026-03-14T20:00:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T20:05:00Z').getTime() / 1000,
          id: 'seg-1',
        },
        {
          start_time: new Date('2026-03-14T20:20:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T20:30:00Z').getTime() / 1000,
          id: 'seg-2',
        },
      ];

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      const seekTime = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:10:00Z'),
      );

      // Only first 5-minute segment counts; second segment starts after target.
      expect(seekTime).toBe(5 * 60);
    });

    it('should clamp segment start to startTime in seek', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const startTime = new Date('2026-03-14T20:05:00Z');
      const endTime = new Date('2026-03-14T20:15:00Z');
      const media = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        cameraID: 'camera-1',
        startTime,
        endTime,
      });

      // Segment starts before the media start time.
      const segments = [
        {
          start_time: new Date('2026-03-14T20:00:00Z').getTime() / 1000,
          end_time: new Date('2026-03-14T20:20:00Z').getTime() / 1000,
          id: 'seg-1',
        },
      ];

      vi.mocked(getRecordingSegments).mockResolvedValue(segments);

      const seekTime = await createEngine().getMediaSeekTime(
        createHASS(),
        store,
        media,
        new Date('2026-03-14T20:10:00Z'),
      );

      // From startTime (20:05) to target (20:10) = 5 minutes.
      expect(seekTime).toBe(5 * 60);
    });
  });

  describe('getMediaMetadata', () => {
    it('should return cached results', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([
        {
          camera: 'camera-1',
          day: '2026-03-14',
          label: 'person',
          sub_label: null,
          zones: [],
        },
      ]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const query = {
        type: QueryType.MediaMetadata as const,
        cameraIDs: new Set(['camera-1']),
      };

      await engine.getMediaMetadata(hass, store, query);
      await engine.getMediaMetadata(hass, store, query);

      expect(getEventSummary).toHaveBeenCalledTimes(1);
    });

    it('should aggregate event metadata', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([
        {
          camera: 'camera-1',
          day: '2026-03-14',
          label: 'person',
          sub_label: 'john, jane',
          zones: ['front_yard', 'driveway'],
        },
        {
          camera: 'camera-1',
          day: '2026-03-15',
          label: 'car',
          sub_label: null,
          zones: [],
        },
      ]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const result = await createEngine().getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.what).toEqual(new Set(['person', 'car']));
      expect(queryResult.metadata.where).toEqual(new Set(['front_yard', 'driveway']));
      expect(queryResult.metadata.tags).toEqual(new Set(['john', 'jane']));
      expect(queryResult.metadata.days).toContain('2026-03-14');
      expect(queryResult.metadata.days).toContain('2026-03-15');
    });

    it('should include recording days in metadata', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([
        {
          day: new Date('2026-03-14'),
          events: 3,
          hours: [{ hour: 10, duration: 3600, events: 3 }],
        },
      ]);

      const result = await createEngine().getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.days).toBeDefined();
      assert(queryResult.metadata.days);
      expect(queryResult.metadata.days.size).toBeGreaterThan(0);
    });

    it('should skip events from non-configured cameras', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([
        {
          camera: 'other-camera',
          day: '2026-03-14',
          label: 'dog',
          sub_label: null,
          zones: [],
        },
      ]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const result = await createEngine().getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.what).toBeUndefined();
    });

    it('should skip cache when useCache is false', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const query = {
        type: QueryType.MediaMetadata as const,
        cameraIDs: new Set(['camera-1']),
      };

      await engine.getMediaMetadata(hass, store, query);
      await engine.getMediaMetadata(hass, store, query, { useCache: false });

      expect(getEventSummary).toHaveBeenCalledTimes(2);
    });

    it('should handle metadata with empty zones and no sub_label', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([
        {
          camera: 'camera-1',
          day: '2026-03-14',
          label: 'person',
          sub_label: null,
          zones: [],
        },
      ]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const result = await createEngine().getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.what).toEqual(new Set(['person']));
      expect(queryResult.metadata.where).toBeUndefined();
      expect(queryResult.metadata.tags).toBeUndefined();
    });

    it('should handle metadata where recordings return null', async () => {
      // Camera with empty name skips recordings (no camera_name to query).
      const config = createCameraConfig({
        frigate: { camera_name: '', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([]);

      const result = await createEngine().getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.days).toBeUndefined();
    });

    it('should handle event summary with empty label and day', async () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([
        {
          camera: 'camera-1',
          day: '',
          label: '',
          sub_label: null,
          zones: [],
        },
      ]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const result = await createEngine().getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      // Empty strings are falsy, so neither label nor day is added.
      expect(queryResult.metadata.what).toBeUndefined();
      expect(queryResult.metadata.days).toBeUndefined();
    });

    it('should re-fetch when cached result has expired', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      const query = {
        type: QueryType.MediaMetadata as const,
        cameraIDs: new Set(['camera-1']),
      };

      // First call populates cache.
      await engine.getMediaMetadata(hass, store, query);

      // Spy on requestCache.get to return null (simulating expired/null cache).
      vi.spyOn(requestCache, 'has').mockReturnValue(true);
      vi.spyOn(requestCache, 'get').mockReturnValue(null);

      const result = await engine.getMediaMetadata(hass, store, query);

      assert(result);
      // Even though cache.has returns true, cache.get returns null,
      // so it falls through to re-fetch.
      expect(getEventSummary).toHaveBeenCalledTimes(2);
    });

    it('should skip metadata cache write when useCache is false', async () => {
      const requestCache = new CameraManagerRequestCache();
      const engine = createEngine({ requestCache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      vi.mocked(getEventSummary).mockResolvedValue([]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([]);

      await engine.getMediaMetadata(
        hass,
        store,
        {
          type: QueryType.MediaMetadata,
          cameraIDs: new Set(['camera-1']),
        },
        { useCache: false },
      );

      await engine.getMediaMetadata(hass, store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      expect(getEventSummary).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMediaCapabilities', () => {
    it('should return canFavorite true for event media', () => {
      const media = createClipMedia();
      const capabilities = createEngine().getMediaCapabilities(media);

      expect(capabilities).toEqual({
        canFavorite: true,
        canDownload: true,
      });
    });

    it('should return canFavorite false for non-event media', () => {
      const media = createRecordingMedia();
      const capabilities = createEngine().getMediaCapabilities(media);

      expect(capabilities).toEqual({
        canFavorite: false,
        canDownload: true,
      });
    });
  });

  describe('getCameraMetadata', () => {
    it('should use camera title when set', () => {
      const config = createCameraConfig({
        title: 'My Camera',
        frigate: { camera_name: 'camera-1' },
      });

      const metadata = createEngine().getCameraMetadata(createHASS(), config);
      expect(metadata.title).toBe('My Camera');
      expect(metadata.engineIcon).toBe('frigate');
    });

    it('should fall back to frigate camera_name', () => {
      const config = createCameraConfig({
        frigate: { camera_name: 'front_door' },
      });

      const metadata = createEngine().getCameraMetadata(createHASS(), config);

      expect(metadata.title).toBe('Front Door');
    });

    it('should fall back to empty string', () => {
      const metadata = createEngine().getCameraMetadata(
        createHASS(),
        createCameraConfig({ frigate: { camera_name: '' } }),
      );

      expect(metadata.title).toBe('');
    });

    it('should fall back to camera id', () => {
      const metadata = createEngine().getCameraMetadata(
        createHASS(),
        createCameraConfig({ id: 'my-camera', frigate: { camera_name: '' } }),
      );

      expect(metadata.title).toBe('my-camera');
    });
  });

  describe('segment garbage collection', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should garbage collect expired segments', async () => {
      vi.useFakeTimers();

      const cache = new RecordingSegmentsCache();
      const engine = createEngine({ cache });
      const hass = createHASS();
      const config = createCameraConfig({
        frigate: { camera_name: 'camera-1', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const start = new Date('2026-03-14T20:00:00Z');
      const end = new Date('2026-03-14T21:00:00Z');

      // Add segments to the cache so GC has something to process.
      cache.add('camera-1', { start, end }, [
        {
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          id: 'seg-1',
        },
      ]);

      vi.mocked(getRecordingSegments).mockResolvedValue([
        {
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          id: 'seg-1',
        },
      ]);
      vi.mocked(getRecordingsSummary).mockResolvedValue([
        {
          day: new Date(2026, 2, 14, 0, 0, 0),
          events: 1,
          hours: [{ hour: 20, duration: 3600, events: 1 }],
        },
      ]);

      // Trigger getRecordingSegments which schedules GC via
      // runWhenIdleIfSupported -> throttle.
      await engine.getRecordingSegments(hass, store, {
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera-1']),
        start,
        end,
      });

      // In jsdom, requestIdleCallback falls back to setTimeout(fn, 0).
      // Then the lodash throttle (leading: false, trailing: true) needs
      // the 1-hour timer to fire.
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1);

      // getRecordingsSummary is called by getRecordings, which is called
      // internally by _garbageCollectSegments. Verifying it was called
      // confirms the throttled GC callback fired.
      expect(getRecordingsSummary).toHaveBeenCalled();
    });

    it('should return early when getRecordings returns null', async () => {
      vi.useFakeTimers();

      const cache = new RecordingSegmentsCache();
      const engine = createEngine({ cache });
      const hass = createHASS();
      // Camera with no camera_name so getRecordings returns null.
      const config = createCameraConfig({
        frigate: { camera_name: '', client_id: 'client-1' },
      });
      const store = createStore([{ cameraID: 'camera-1', config }]);

      const start = new Date('2026-03-14T20:00:00Z');
      const end = new Date('2026-03-14T21:00:00Z');
      cache.add('camera-1', { start, end }, [
        {
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          id: 'seg-1',
        },
      ]);

      vi.mocked(getRecordingSegments).mockResolvedValue([
        {
          start_time: start.getTime() / 1000,
          end_time: end.getTime() / 1000,
          id: 'seg-1',
        },
      ]);

      await engine.getRecordingSegments(hass, store, {
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera-1']),
        start,
        end,
      });

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1);

      // GC returned early because getRecordings returned null
      // (no camera_name). Segments remain in cache.
      expect(cache.getSize('camera-1')).toBe(1);
    });
  });
});
