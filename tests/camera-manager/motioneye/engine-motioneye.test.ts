// @vitest-environment jsdom
import { endOfDay, startOfDay } from 'date-fns';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { Camera } from '../../../src/camera-manager/camera';
import { MotionEyeCamera } from '../../../src/camera-manager/motioneye/camera';
import { MotionEyeCameraManagerEngine } from '../../../src/camera-manager/motioneye/engine-motioneye';
import { MotionEyeEventQueryResults } from '../../../src/camera-manager/motioneye/types';
import { CameraManagerStore } from '../../../src/camera-manager/store';
import {
  CameraManagerRequestCache,
  Engine,
  EventQueryResults,
  QueryResultsType,
  QueryType,
} from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { BrowseMediaMetadata } from '../../../src/ha/browse-media/types';
import { BrowseMediaStep, BrowseMediaWalker } from '../../../src/ha/browse-media/walker';
import { Entity } from '../../../src/ha/registry/entity/types';
import { ResolvedMediaCache } from '../../../src/ha/resolved-media';
import { QuerySource } from '../../../src/query-source';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import {
  createCameraConfig,
  createHASS,
  createRegistryEntity,
  createRichBrowseMedia,
} from '../../test-utils';

vi.mock('../../../src/ha/browse-media/browse-media-to-view-media');

const CAMERA_ENTITY_ID = 'camera.motioneye_test';
const CONFIG_ENTRY_ID = 'config-entry-1';
const DEVICE_ID = 'device-1';

const createEntity = (overrides?: Partial<Entity>): Entity =>
  createRegistryEntity({
    entity_id: CAMERA_ENTITY_ID,
    config_entry_id: CONFIG_ENTRY_ID,
    device_id: DEVICE_ID,
    platform: 'motioneye',
    ...overrides,
  });

const createEngine = (options?: {
  entities?: Entity[];
  walker?: BrowseMediaWalker;
  requestCache?: CameraManagerRequestCache;
}): MotionEyeCameraManagerEngine => {
  return new MotionEyeCameraManagerEngine(
    new EntityRegistryManagerMock(options?.entities ?? [createEntity()]),
    mock<StateWatcher>(),
    options?.walker ?? new BrowseMediaWalker(),
    new ResolvedMediaCache(),
    options?.requestCache ?? new CameraManagerRequestCache(),
  );
};

const createMotionEyeStore = async (
  engine: MotionEyeCameraManagerEngine,
  options?: {
    cameraID?: string;
    cameraEntity?: string;
    entityOverrides?: Partial<Entity>;
  },
): Promise<CameraManagerStore> => {
  const entity = createEntity(options?.entityOverrides);
  const config = createCameraConfig({
    camera_entity: options?.cameraEntity ?? CAMERA_ENTITY_ID,
  });
  const camera = new MotionEyeCamera(config, engine);
  await camera.initialize({
    hass: createHASS(),
    entityRegistryManager: new EntityRegistryManagerMock([entity]),
    stateWatcher: mock<StateWatcher>(),
  });
  camera.setID(options?.cameraID ?? 'camera-1');
  const store = new CameraManagerStore();
  store.addCamera(camera);
  return store;
};

const getDirectorySteps = (
  walker: MockProxy<BrowseMediaWalker>,
): BrowseMediaStep<BrowseMediaMetadata>[] => {
  const steps = walker.walk.mock.calls[0][1];
  assert(steps);
  return steps as BrowseMediaStep<BrowseMediaMetadata>[];
};

const getFileSteps = (
  walker: MockProxy<BrowseMediaWalker>,
): BrowseMediaStep<BrowseMediaMetadata>[] => {
  assert(walker.walk.mock.calls.length >= 2);
  const steps = walker.walk.mock.calls[1][1];
  assert(steps);
  return steps as BrowseMediaStep<BrowseMediaMetadata>[];
};

const createDirectoryResult = () =>
  createRichBrowseMedia({
    can_expand: true,
    _metadata: {
      cameraID: 'camera-1',
      startDate: startOfDay(new Date('2026-03-14')),
      endDate: endOfDay(new Date('2026-03-14')),
    },
  });

const createDefaultEventQuery = (overrides?: Record<string, unknown>) => ({
  type: QueryType.Event as const,
  source: QuerySource.Camera as const,
  cameraIDs: new Set(['camera-1']),
  ...overrides,
});

describe('MotionEyeCameraManagerEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEngineType', () => {
    it('should return MotionEye engine type', () => {
      expect(createEngine().getEngineType()).toBe(Engine.MotionEye);
    });
  });

  describe('createCamera', () => {
    it('should create a MotionEyeCamera', async () => {
      const engine = createEngine({ entities: [createEntity()] });
      const config = createCameraConfig({
        camera_entity: CAMERA_ENTITY_ID,
      });

      const camera = await engine.createCamera(createHASS(), config);

      expect(camera).toBeInstanceOf(Camera);
      expect(camera).toBeInstanceOf(MotionEyeCamera);
    });
  });

  describe('getEvents', () => {
    it('should return null for unsupported filters', async () => {
      const engine = createEngine();
      const store = await createMotionEyeStore(engine);

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery({ favorite: true }),
      );

      expect(result).toBeNull();
    });

    it('should return null when camera is not EntityCamera', async () => {
      const engine = createEngine();
      const store = new CameraManagerStore();
      const camera = new Camera(createCameraConfig(), engine);
      camera.setID('camera-1');
      store.addCamera(camera);

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery(),
      );

      expect(result).toBeNull();
    });

    it('should return null when entity has no config_entry_id', async () => {
      const entity = createEntity({ config_entry_id: null });
      const engine = createEngine({ entities: [entity] });
      const store = await createMotionEyeStore(engine, {
        entityOverrides: { config_entry_id: null },
      });

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery(),
      );

      expect(result).toBeNull();
    });

    it('should return null when entity has no device_id', async () => {
      const entity = createEntity({ device_id: null });
      const engine = createEngine({ entities: [entity] });
      const store = await createMotionEyeStore(engine, {
        entityOverrides: { device_id: null },
      });

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery(),
      );

      expect(result).toBeNull();
    });

    it('should return null when walker returns empty directories', async () => {
      const walker = mock<BrowseMediaWalker>();
      walker.walk.mockResolvedValue([]);
      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery(),
      );

      expect(result).toBeNull();
    });

    it('should return null when camera config not found', async () => {
      const walker = mock<BrowseMediaWalker>();
      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery({ cameraIDs: new Set(['nonexistent']) }),
      );

      expect(result).toBeNull();
    });

    it('should return event results from walker', async () => {
      const walker = mock<BrowseMediaWalker>();
      walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
      walker.walk.mockResolvedValueOnce([
        createRichBrowseMedia({
          title: '20-15-00.mp4',
          media_class: 'video',
          can_expand: false,
          _metadata: {
            cameraID: 'camera-1',
            startDate: new Date('2026-03-14T20:15:00'),
            endDate: new Date('2026-03-14T20:15:00'),
          },
        }),
      ]);

      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery(),
      );

      assert(result);
      expect(result.size).toBe(1);
      const queryResult = [...result.values()][0];
      expect(queryResult.engine).toBe(Engine.MotionEye);
      expect(queryResult.type).toBe(QueryResultsType.Event);
    });

    it('should use cache when available', async () => {
      const walker = mock<BrowseMediaWalker>();
      const requestCache = new CameraManagerRequestCache();
      walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
      walker.walk.mockResolvedValueOnce([]);

      const engine = createEngine({ walker, requestCache });
      const store = await createMotionEyeStore(engine);
      const query = createDefaultEventQuery();

      await engine.getEvents(createHASS(), store, query);
      await engine.getEvents(createHASS(), store, query);

      // Only 2 calls (dir + file) for the first request; second uses cache.
      expect(walker.walk).toHaveBeenCalledTimes(2);
    });

    it('should skip cache when useCache is false', async () => {
      const walker = mock<BrowseMediaWalker>();
      const requestCache = new CameraManagerRequestCache();
      walker.walk.mockResolvedValue([createDirectoryResult()]);

      const engine = createEngine({ walker, requestCache });
      const store = await createMotionEyeStore(engine);
      const query = createDefaultEventQuery();

      await engine.getEvents(createHASS(), store, query, { useCache: false });
      await engine.getEvents(createHASS(), store, query, { useCache: false });

      // Both requests hit the walker: 2 calls (dir + file) per request.
      expect(walker.walk).toHaveBeenCalledTimes(4);
    });

    it('should not pass directory cache when useCache is false', async () => {
      const walker = mock<BrowseMediaWalker>();
      walker.walk.mockResolvedValue([]);
      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      await engine.getEvents(createHASS(), store, createDefaultEventQuery(), {
        useCache: false,
      });

      expect(walker.walk).toHaveBeenCalledWith(expect.anything(), expect.anything(), {});
    });

    it('should sort results descending and apply limit', async () => {
      const walker = mock<BrowseMediaWalker>();
      walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
      const earlyMedia = createRichBrowseMedia({
        title: 'early.mp4',
        _metadata: {
          cameraID: 'camera-1',
          startDate: new Date('2026-03-14T10:00:00'),
          endDate: new Date('2026-03-14T10:00:00'),
        },
      });
      const lateMedia = createRichBrowseMedia({
        title: 'late.mp4',
        _metadata: {
          cameraID: 'camera-1',
          startDate: new Date('2026-03-14T20:00:00'),
          endDate: new Date('2026-03-14T20:00:00'),
        },
      });
      walker.walk.mockResolvedValueOnce([earlyMedia, lateMedia]);

      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      const result = await engine.getEvents(
        createHASS(),
        store,
        createDefaultEventQuery({ limit: 1 }),
      );

      assert(result);
      const queryResult = [...result.values()][0] as MotionEyeEventQueryResults;
      expect(queryResult.browseMedia).toHaveLength(1);
      expect(queryResult.browseMedia[0].title).toBe('late.mp4');
    });

    describe('directory steps', () => {
      it('should produce steps for both movies and images by default', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        expect(getDirectorySteps(walker)).toHaveLength(2);
      });

      it('should produce only movies step when hasClip is true', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(
          createHASS(),
          store,
          createDefaultEventQuery({ hasClip: true }),
        );

        const steps = getDirectorySteps(walker);
        expect(steps).toHaveLength(1);
        expect(steps[0].targets[0]).toContain('#movies');
      });

      it('should produce only images step when hasSnapshot is true', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(
          createHASS(),
          store,
          createDefaultEventQuery({ hasSnapshot: true }),
        );

        const steps = getDirectorySteps(walker);
        expect(steps).toHaveLength(1);
        expect(steps[0].targets[0]).toContain('#images');
      });

      it('should parse valid date directories into metadata', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const step = getDirectorySteps(walker)[0];
        assert(step.metadataGenerator);

        const metadata = step.metadataGenerator(
          createRichBrowseMedia({ title: '2026-03-14' }),
        );

        assert(metadata);
        expect(metadata.cameraID).toBe('camera-1');
        expect(metadata.startDate).toEqual(startOfDay(new Date(2026, 2, 14)));
      });

      it('should return null metadata for invalid date directories', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const step = getDirectorySteps(walker)[0];
        assert(step.metadataGenerator);

        const metadata = step.metadataGenerator(
          createRichBrowseMedia({ title: 'not-a-date' }),
        );

        expect(metadata).toBeNull();
      });

      it('should match only expandable directories', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const step = getDirectorySteps(walker)[0];
        assert(step.matcher);

        const expandable = createRichBrowseMedia({
          can_expand: true,
          _metadata: {
            startDate: new Date('2026-03-14'),
            endDate: new Date('2026-03-14'),
          },
        });
        expect(step.matcher(expandable)).toBe(true);

        const nonExpandable = createRichBrowseMedia({
          can_expand: false,
          _metadata: {
            startDate: new Date('2026-03-14'),
            endDate: new Date('2026-03-14'),
          },
        });
        expect(step.matcher(nonExpandable)).toBe(false);
      });

      it('should return empty from advance when pattern has a single part', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const step = getDirectorySteps(walker)[0];
        assert(step.advance);

        const nextSteps = step.advance([createRichBrowseMedia({ can_expand: true })]);
        // Default pattern '%Y-%m-%d' is a single part, so no further steps.
        expect(nextSteps).toEqual([]);
      });

      it('should use parent metadata for literal directory parts', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const config = createCameraConfig({
          camera_entity: CAMERA_ENTITY_ID,
          motioneye: {
            movies: {
              directory_pattern: 'fixed/%Y-%m-%d',
              file_pattern: '%H-%M-%S',
            },
            images: {
              directory_pattern: 'fixed/%Y-%m-%d',
              file_pattern: '%H-%M-%S',
            },
          },
        });

        const engine = createEngine({ walker });
        const camera = new MotionEyeCamera(config, engine);
        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([createEntity()]),
          stateWatcher: mock<StateWatcher>(),
        });
        camera.setID('camera-1');
        const store = new CameraManagerStore();
        store.addCamera(camera);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fixedStep = getDirectorySteps(walker)[0];
        assert(fixedStep.metadataGenerator);

        const parentMedia = createRichBrowseMedia({
          _metadata: {
            startDate: new Date('2026-03-14'),
            endDate: new Date('2026-03-15'),
          },
        });
        const metadata = fixedStep.metadataGenerator(
          createRichBrowseMedia({ title: 'fixed' }),
          parentMedia,
        );

        assert(metadata);
        expect(metadata.endDate).toEqual(new Date('2026-03-15'));
      });

      it('should match literal directory parts by title', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const config = createCameraConfig({
          camera_entity: CAMERA_ENTITY_ID,
          motioneye: {
            movies: {
              directory_pattern: 'fixed/%Y-%m-%d',
              file_pattern: '%H-%M-%S',
            },
            images: {
              directory_pattern: 'fixed/%Y-%m-%d',
              file_pattern: '%H-%M-%S',
            },
          },
        });

        const engine = createEngine({ walker });
        const camera = new MotionEyeCamera(config, engine);
        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([createEntity()]),
          stateWatcher: mock<StateWatcher>(),
        });
        camera.setID('camera-1');
        const store = new CameraManagerStore();
        store.addCamera(camera);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fixedStep = getDirectorySteps(walker)[0];
        assert(fixedStep.matcher);

        const matching = createRichBrowseMedia({
          title: 'fixed',
          can_expand: true,
          _metadata: {
            startDate: new Date('2026-03-14'),
            endDate: new Date('2026-03-14'),
          },
        });
        expect(fixedStep.matcher(matching)).toBe(true);

        const nonMatching = createRichBrowseMedia({
          title: 'other',
          can_expand: true,
          _metadata: {
            startDate: new Date('2026-03-14'),
            endDate: new Date('2026-03-14'),
          },
        });
        expect(fixedStep.matcher(nonMatching)).toBe(false);
      });

      it('should advance to next step for multi-part directory patterns', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValue([]);
        const config = createCameraConfig({
          camera_entity: CAMERA_ENTITY_ID,
          motioneye: {
            movies: {
              directory_pattern: 'fixed/%Y-%m-%d',
              file_pattern: '%H-%M-%S',
            },
            images: {
              directory_pattern: 'fixed/%Y-%m-%d',
              file_pattern: '%H-%M-%S',
            },
          },
        });

        const engine = createEngine({ walker });
        const camera = new MotionEyeCamera(config, engine);
        await camera.initialize({
          hass: createHASS(),
          entityRegistryManager: new EntityRegistryManagerMock([createEntity()]),
          stateWatcher: mock<StateWatcher>(),
        });
        camera.setID('camera-1');
        const store = new CameraManagerStore();
        store.addCamera(camera);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fixedStep = getDirectorySteps(walker)[0];
        assert(fixedStep.advance);

        const nextSteps = fixedStep.advance([
          createRichBrowseMedia({ can_expand: true }),
        ]);
        expect(nextSteps).toHaveLength(1);
      });
    });

    describe('file steps', () => {
      it('should generate metadata for video files', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.metadataGenerator);

        const metadata = fileStep.metadataGenerator(
          createRichBrowseMedia({
            title: '20-15-00.mp4',
            media_class: 'video',
          }),
        );

        assert(metadata);
        expect(metadata.cameraID).toBe('camera-1');
      });

      it('should generate metadata for image files', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.metadataGenerator);

        const metadata = fileStep.metadataGenerator(
          createRichBrowseMedia({
            title: '20-15-00.jpg',
            media_class: 'image',
          }),
        );

        assert(metadata);
        expect(metadata.cameraID).toBe('camera-1');
      });

      it('should return null metadata for non-media files', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.metadataGenerator);

        const metadata = fileStep.metadataGenerator(
          createRichBrowseMedia({
            title: 'readme.txt',
            media_class: 'other',
          }),
        );

        expect(metadata).toBeNull();
      });

      it('should return null metadata for invalid date in file title', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.metadataGenerator);

        const metadata = fileStep.metadataGenerator(
          createRichBrowseMedia({
            title: 'invalid.mp4',
            media_class: 'video',
          }),
        );

        expect(metadata).toBeNull();
      });

      it('should parse time relative to parent startDate', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.metadataGenerator);

        const parent = createRichBrowseMedia({
          _metadata: {
            cameraID: 'camera-1',
            startDate: new Date('2026-03-14T00:00:00'),
            endDate: endOfDay(new Date('2026-03-14')),
          },
        });
        const metadata = fileStep.metadataGenerator(
          createRichBrowseMedia({
            title: '20-15-00.mp4',
            media_class: 'video',
          }),
          parent,
        );

        assert(metadata);
        assert(metadata.startDate);
        expect(metadata.startDate.getHours()).toBe(20);
        expect(metadata.startDate.getMinutes()).toBe(15);
      });

      it('should match only non-expandable files', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.matcher);

        const file = createRichBrowseMedia({
          can_expand: false,
          _metadata: {
            startDate: new Date('2026-03-14T20:15:00'),
            endDate: new Date('2026-03-14T20:15:00'),
          },
        });
        expect(fileStep.matcher(file)).toBe(true);

        const directory = createRichBrowseMedia({
          can_expand: true,
          _metadata: {
            startDate: new Date('2026-03-14T20:15:00'),
            endDate: new Date('2026-03-14T20:15:00'),
          },
        });
        expect(fileStep.matcher(directory)).toBe(false);
      });

      it('should early exit when media count reaches limit', async () => {
        const walker = mock<BrowseMediaWalker>();
        walker.walk.mockResolvedValueOnce([createDirectoryResult()]);
        walker.walk.mockResolvedValueOnce([]);
        const engine = createEngine({ walker });
        const store = await createMotionEyeStore(engine);

        await engine.getEvents(createHASS(), store, createDefaultEventQuery());

        const fileStep = getFileSteps(walker)[0];
        assert(fileStep.earlyExit);

        expect(fileStep.earlyExit([])).toBe(false);

        const manyItems = Array.from({ length: 10000 }, () => createRichBrowseMedia());
        expect(fileStep.earlyExit(manyItems)).toBe(true);
      });
    });
  });

  describe('generateMediaFromEvents', () => {
    it('should return null for non-motioneye results', () => {
      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        new CameraManagerStore(),
        createDefaultEventQuery(),
        {
          type: QueryResultsType.Event,
          engine: Engine.Generic,
        } as EventQueryResults,
      );

      expect(result).toBeNull();
    });

    it('should generate media from motioneye event results', async () => {
      const { getViewMediaFromBrowseMediaArray } = await import(
        '../../../src/ha/browse-media/browse-media-to-view-media'
      );
      vi.mocked(getViewMediaFromBrowseMediaArray).mockReturnValue([]);

      const browseMedia = [createRichBrowseMedia()];
      const result = createEngine().generateMediaFromEvents(
        createHASS(),
        new CameraManagerStore(),
        createDefaultEventQuery(),
        {
          type: QueryResultsType.Event,
          engine: Engine.MotionEye,
          browseMedia,
        } as MotionEyeEventQueryResults,
      );

      expect(result).toEqual([]);
      expect(getViewMediaFromBrowseMediaArray).toHaveBeenCalledWith(browseMedia);
    });
  });

  describe('getMediaMetadata', () => {
    it('should return metadata with days from directories', async () => {
      const walker = mock<BrowseMediaWalker>();
      walker.walk.mockResolvedValue([
        createRichBrowseMedia({
          can_expand: true,
          _metadata: {
            cameraID: 'camera-1',
            startDate: new Date('2026-03-14'),
            endDate: endOfDay(new Date('2026-03-14')),
          },
        }),
        createRichBrowseMedia({
          can_expand: true,
          _metadata: {
            cameraID: 'camera-1',
            startDate: new Date('2026-03-15'),
            endDate: endOfDay(new Date('2026-03-15')),
          },
        }),
      ]);

      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      const result = await engine.getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      assert(queryResult.metadata.days);
      expect(queryResult.metadata.days.size).toBe(2);
    });

    it('should use cache when available', async () => {
      const walker = mock<BrowseMediaWalker>();
      const requestCache = new CameraManagerRequestCache();
      walker.walk.mockResolvedValue([]);

      const engine = createEngine({ walker, requestCache });
      const store = await createMotionEyeStore(engine);

      const query = {
        type: QueryType.MediaMetadata as const,
        cameraIDs: new Set(['camera-1']),
      };

      await engine.getMediaMetadata(createHASS(), store, query);
      await engine.getMediaMetadata(createHASS(), store, query);

      expect(walker.walk).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when useCache is false', async () => {
      const walker = mock<BrowseMediaWalker>();
      const requestCache = new CameraManagerRequestCache();
      walker.walk.mockResolvedValue([]);

      const engine = createEngine({ walker, requestCache });
      const store = await createMotionEyeStore(engine);

      const query = {
        type: QueryType.MediaMetadata as const,
        cameraIDs: new Set(['camera-1']),
      };

      await engine.getMediaMetadata(createHASS(), store, query);
      await engine.getMediaMetadata(createHASS(), store, query, {
        useCache: false,
      });

      expect(walker.walk).toHaveBeenCalledTimes(2);
    });

    it('should handle directories without startDate metadata', async () => {
      const walker = mock<BrowseMediaWalker>();
      walker.walk.mockResolvedValue([
        createRichBrowseMedia({
          can_expand: true,
          _metadata: { cameraID: 'camera-1' },
        }),
      ]);

      const engine = createEngine({ walker });
      const store = await createMotionEyeStore(engine);

      const result = await engine.getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.days).toBeUndefined();
    });

    it('should handle null directories from _getMatchingDirectories', async () => {
      const engine = createEngine();
      const store = new CameraManagerStore();
      const camera = new Camera(createCameraConfig(), engine);
      camera.setID('camera-1');
      store.addCamera(camera);

      const result = await engine.getMediaMetadata(createHASS(), store, {
        type: QueryType.MediaMetadata,
        cameraIDs: new Set(['camera-1']),
      });

      assert(result);
      const queryResult = [...result.values()][0];
      expect(queryResult.metadata.days).toBeUndefined();
    });

    it('should re-fetch when cached result is expired', async () => {
      const walker = mock<BrowseMediaWalker>();
      const requestCache = new CameraManagerRequestCache();
      walker.walk.mockResolvedValue([]);

      const engine = createEngine({ walker, requestCache });
      const store = await createMotionEyeStore(engine);

      const query = {
        type: QueryType.MediaMetadata as const,
        cameraIDs: new Set(['camera-1']),
      };

      await engine.getMediaMetadata(createHASS(), store, query);

      vi.spyOn(requestCache, 'has').mockReturnValue(true);
      vi.spyOn(requestCache, 'get').mockReturnValue(null);

      await engine.getMediaMetadata(createHASS(), store, query);

      expect(walker.walk).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCameraMetadata', () => {
    it('should return motioneye engine icon', () => {
      const config = createCameraConfig({
        title: 'My Camera',
        camera_entity: CAMERA_ENTITY_ID,
      });

      const metadata = createEngine().getCameraMetadata(createHASS(), config);

      expect(metadata.title).toBe('My Camera');
      expect(metadata.engineIcon).toBe('motioneye');
    });
  });
});
