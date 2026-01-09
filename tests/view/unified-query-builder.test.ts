import { assert, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../src/camera-manager/manager';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { QueryType } from '../../src/camera-manager/types';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import {
  FolderPathComponent,
  FolderQuery,
} from '../../src/card-controller/folders/types';
import { FolderConfig } from '../../src/config/schema/folders';
import { QuerySource } from '../../src/query-source';
import {
  MediaTypeSpec,
  UnifiedQueryBuilder,
} from '../../src/view/unified-query-builder';
import {
  createCameraConfig,
  createCapabilities,
  createFolder,
  isRecordingQuery,
  isReviewQuery,
} from '../test-utils';

// Helper to create FolderQuery for tests
const createFolderQueryParams = (
  folder: FolderConfig,
  path: [FolderPathComponent, ...FolderPathComponent[]],
): FolderQuery => ({
  source: QuerySource.Folder,
  folder,
  path,
});

const createMocks = () => {
  const cameraManager = mock<CameraManager>();
  const foldersManager = mock<FoldersManager>();
  const store = mock<CameraManagerStore>();
  cameraManager.getStore.mockReturnValue(store);
  cameraManager.getDefaultQueryParameters.mockReturnValue({});
  return { cameraManager, foldersManager, store };
};

describe('MediaTypeSpec', () => {
  describe('factory helpers', () => {
    it('clips() returns correct spec', () => {
      expect(MediaTypeSpec.clips()).toEqual({
        mediaType: 'events',
        eventsSubtype: 'clips',
      });
    });

    it('snapshots() returns correct spec', () => {
      expect(MediaTypeSpec.snapshots()).toEqual({
        mediaType: 'events',
        eventsSubtype: 'snapshots',
      });
    });

    it('recordings() returns correct spec', () => {
      expect(MediaTypeSpec.recordings()).toEqual({ mediaType: 'recordings' });
    });

    it('reviews() returns correct spec', () => {
      expect(MediaTypeSpec.reviews()).toEqual({ mediaType: 'reviews' });
    });
  });
});

describe('UnifiedQueryBuilder', () => {
  describe('buildClipsQuery', () => {
    it('should return query with no nodes when empty camera IDs', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildClipsQuery(new Set());
      expect(query).toBeNull();
    });

    it('should build clips query with hasClip=true', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildClipsQuery(new Set(['camera1']));

      assert(query);
      expect(query.getNodes()).toHaveLength(1);
      expect(query.getNodes()[0]).toMatchObject({
        source: QuerySource.Camera,
        type: QueryType.Event,
        hasClip: true,
        cameraIDs: new Set(['camera1']),
      });
      expect(query.getNodes()[0]).not.toHaveProperty('hasSnapshot');
    });

    it('should apply all MediaQueryBuildOptions', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      const query = builder.buildClipsQuery(new Set(['camera1']), {
        start,
        end,
        limit: 25,
      });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        start,
        end,
        limit: 25,
      });
    });
  });

  describe('buildSnapshotsQuery', () => {
    it('should build snapshots query with hasSnapshot=true', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildSnapshotsQuery(new Set(['camera1']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasSnapshot: true,
      });
      expect(query.getNodes()[0]).not.toHaveProperty('hasClip');
    });
  });

  describe('buildEventsQuery', () => {
    it('should build events query without clip/snapshot filter', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildEventsQuery(new Set(['camera1']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Event });
      expect(query.getNodes()[0]).not.toHaveProperty('hasClip');
      expect(query.getNodes()[0]).not.toHaveProperty('hasSnapshot');
    });
  });

  describe('buildRecordingsQuery', () => {
    it('should return null if no camera IDs provided', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      expect(builder.buildRecordingsQuery(new Set())).toBeNull();
    });

    it('should build recordings query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildRecordingsQuery(new Set(['camera1']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Recording,
        cameraIDs: new Set(['camera1']),
      });
    });

    it('should apply options to recordings query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildRecordingsQuery(new Set(['camera1']), {
        limit: 10,
      });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Recording,
        limit: 10,
      });
    });
  });

  describe('buildReviewsQuery', () => {
    it('should return query with no nodes when empty camera IDs', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildReviewsQuery(new Set());
      expect(query).toBeNull();
    });

    it('should build reviews query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildReviewsQuery(new Set(['camera1']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Review });
    });

    it('should apply reviewed option', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildReviewsQuery(new Set(['camera1']), {
        reviewed: true,
      });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Review,
        reviewed: true,
      });
    });

    it('should apply reviewed=false option', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildReviewsQuery(new Set(['camera1']), {
        reviewed: false,
      });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Review,
        reviewed: false,
      });
    });
  });

  describe('getAllMediaCapableCameraIDs', () => {
    it('should return cameras with any media capability', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera1', 'camera2']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const result = builder.getAllMediaCapableCameraIDs();

      expect(result).toEqual(new Set(['camera1', 'camera2']));
      expect(store.getCameraIDsWithCapability).toHaveBeenCalledWith({
        anyCapabilities: ['clips', 'snapshots', 'recordings', 'reviews'],
      });
    });
  });

  describe('buildFilterQuery', () => {
    it('should use default cameras when null provided', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(null, new Set(['clips']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        cameraIDs: new Set(['camera.office']),
      });
    });

    it('should use default media types when null provided', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(new Set(['camera.office']), null);

      assert(query);

      // clips, snapshots, recordings, reviews
      expect(query.getNodes()).toHaveLength(4);
    });

    it('should build clips filter query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(
        new Set(['camera.office']),
        new Set(['clips']),
      );

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasClip: true,
      });
    });

    it('should build snapshots filter query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(
        new Set(['camera.office']),
        new Set(['snapshots']),
      );

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasSnapshot: true,
      });
    });

    it('should build recordings filter query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(
        new Set(['camera.office']),
        new Set(['recordings']),
      );

      assert(query);
      assert(isRecordingQuery(query.getNodes()[0]));
    });

    it('should build reviews filter query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(
        new Set(['camera.office']),
        new Set(['reviews']),
      );

      assert(query);
      assert(isReviewQuery(query.getNodes()[0]));
    });

    it('should apply all filter options', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');
      const tags = new Set(['tag1']);
      const what = new Set(['person']);
      const where = new Set(['zone1']);

      const query = builder.buildFilterQuery(
        new Set(['camera.office']),
        new Set(['clips']),
        {
          start,
          end,
          limit: 5,
          favorite: true,
          tags,
          what,
          where,
          reviewed: false,
        },
      );

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        start,
        end,
        limit: 5,
        favorite: true,
        tags,
        what,
        where,
      });
    });

    it('should apply reviewed option to reviews query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);

      const query = builder.buildFilterQuery(
        new Set(['camera.office']),
        new Set(['reviews']),
        {
          reviewed: true,
        },
      );

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Review,
        reviewed: true,
      });
    });

    it('should return null when no cameras available', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildFilterQuery(new Set(), null);

      expect(query).toBeNull();
    });
  });

  describe('buildFolderQueryWithPath', () => {
    it('should build folder query', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const folder = createFolder({ id: 'folder1', title: 'Test' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      const query = builder.buildFolderQueryWithPath(folder, path);

      const nodes = query.getNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        source: QuerySource.Folder,
        folder,
        path,
      });
    });

    it('should apply limit option', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const folder = createFolder({ id: 'folder1', title: 'Test' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      const query = builder.buildFolderQueryWithPath(folder, path, {
        limit: 10,
      });

      expect(query.getNodes()[0]).toMatchObject({
        source: QuerySource.Folder,
        limit: 10,
      });
    });

    it('should not include limit when not provided', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const folder = createFolder({ id: 'folder1', title: 'Test' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      const query = builder.buildFolderQueryWithPath(folder, path);

      expect(query.getNodes()[0]).toMatchObject({
        source: QuerySource.Folder,
      });
      expect(query.getNodes()[0]).not.toHaveProperty('limit');
    });
  });

  describe('buildDefaultFolderQuery', () => {
    it('should build query from folder manager params', () => {
      const { cameraManager, foldersManager } = createMocks();
      const folder = createFolder({ id: 'folder1', title: 'Test' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      foldersManager.getFolder.mockReturnValue(folder);
      foldersManager.getDefaultQueryParameters.mockReturnValue(
        createFolderQueryParams(folder, path),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultFolderQuery('folder1');

      assert(query);
      expect(query.hasNodes()).toBe(true);
      expect(foldersManager.getFolder).toHaveBeenCalledWith('folder1');
    });

    it('should return empty query when folder not found', () => {
      const { cameraManager, foldersManager } = createMocks();
      foldersManager.getFolder.mockReturnValue(null);

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultFolderQuery('nonexistent');
      expect(query).toBeNull();
    });

    it('should return empty query when no default params', () => {
      const { cameraManager, foldersManager } = createMocks();
      const folder = createFolder({ id: 'folder1', title: 'Test' });
      foldersManager.getFolder.mockReturnValue(folder);
      foldersManager.getDefaultQueryParameters.mockReturnValue(null);

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultFolderQuery('folder1');
      expect(query).toBeNull();
    });

    it('should apply limit option', () => {
      const { cameraManager, foldersManager } = createMocks();
      const folder = createFolder({ id: 'folder1', title: 'Test' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      foldersManager.getFolder.mockReturnValue(folder);
      foldersManager.getDefaultQueryParameters.mockReturnValue(
        createFolderQueryParams(folder, path),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultFolderQuery('folder1', { limit: 20 });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        source: QuerySource.Folder,
        limit: 20,
      });
    });

    it('should use default folder when no ID provided', () => {
      const { cameraManager, foldersManager } = createMocks();
      foldersManager.getFolder.mockReturnValue(null);

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      builder.buildDefaultFolderQuery();

      expect(foldersManager.getFolder).toHaveBeenCalledWith(undefined);
    });
  });

  describe('buildDefaultCameraQuery', () => {
    it('should return null when no cameras available', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      expect(query).toBeNull();
    });

    it('should use all cameras when no ID provided', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office', 'cam2']));
      cameraManager.getCameraCapabilities.mockReturnValue(null);

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      builder.buildDefaultCameraQuery();

      expect(store.getCameraIDs).toHaveBeenCalled();
    });

    it('should use dependent cameras when ID provided', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getAllDependentCameras.mockReturnValue(new Set(['camera.office', 'dep1']));
      cameraManager.getCameraCapabilities.mockReturnValue(null);

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      builder.buildDefaultCameraQuery('camera.office');

      expect(store.getAllDependentCameras).toHaveBeenCalledWith('camera.office');
    });

    it('should build reviews query for camera with reviews capability', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'auto' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ reviews: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      assert(isReviewQuery(query.getNodes()[0]));
    });

    it('should build clips query for camera with clips capability', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'auto' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ clips: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasClip: true,
      });
    });

    it('should build snapshots query for camera with only snapshots', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'auto' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ snapshots: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasSnapshot: true,
      });
    });

    it('should build recordings query for camera with only recordings', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'auto' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ recordings: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      assert(isRecordingQuery(query.getNodes()[0]));
    });

    it('should respect explicit recordings media type config', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'recordings' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ recordings: true, reviews: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      assert(isRecordingQuery(query.getNodes()[0]));
    });

    it('should respect explicit reviews media type config', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'reviews' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ reviews: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      assert(isReviewQuery(query.getNodes()[0]));
    });

    it('should handle explicit events type with clips', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'events', events_type: 'clips' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ clips: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasClip: true,
      });
    });

    it('should handle explicit events type with snapshots', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'events', events_type: 'snapshots' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ snapshots: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasSnapshot: true,
      });
    });

    it('should handle events_type=all with both capabilities', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'events', events_type: 'all' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ clips: true, snapshots: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Event });
      // Both capabilities present with 'all' means no specific filter
      expect(query.getNodes()[0]).not.toHaveProperty('hasClip');
      expect(query.getNodes()[0]).not.toHaveProperty('hasSnapshot');
    });

    it('should handle events_type=all with only clips', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'events', events_type: 'all' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ clips: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasClip: true,
      });
    });

    it('should handle events_type=all with only snapshots', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'events', events_type: 'all' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ snapshots: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasSnapshot: true,
      });
    });

    it('should apply limit option', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'recordings' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(
        createCapabilities({ recordings: true }),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery(undefined, { limit: 15 });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Recording,
        limit: 15,
      });
    });

    it('should return null when camera has no capabilities', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      cameraManager.getCameraCapabilities.mockReturnValue(null);

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      expect(query).toBeNull();
    });

    it('should return null for auto mode when no matching capabilities', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'auto' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(createCapabilities());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      expect(query).toBeNull();
    });

    it('should build folder query for folder media type', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'folder', folders: ['folder1'] } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(createCapabilities());

      const folder = createFolder({ id: 'folder1', title: 'Test Folder' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      foldersManager.getFolder.mockReturnValue(folder);
      foldersManager.getDefaultQueryParameters.mockReturnValue(
        createFolderQueryParams(folder, path),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        source: QuerySource.Folder,
        folder: expect.objectContaining({ id: 'folder1' }),
      });
    });

    it('should build default folder query for folder media type without specific folders', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'folder' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(createCapabilities());

      const folder = createFolder({ id: 'default-folder', title: 'Default' });
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      // Mock getting the default folder (id undefined)
      foldersManager.getFolder.calledWith(undefined).mockReturnValue(folder);
      foldersManager.getDefaultQueryParameters.mockReturnValue(
        createFolderQueryParams(folder, path),
      );

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        source: QuerySource.Folder,
        folder: expect.objectContaining({ id: 'default-folder' }),
      });
    });

    it('should return null when events type specified but no clips/snapshots capability', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'events', events_type: 'clips' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(createCapabilities());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      expect(query).toBeNull();
    });

    it('should return null when recordings type specified but no recordings capability', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'recordings' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(createCapabilities());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      expect(query).toBeNull();
    });

    it('should return null when reviews type specified but no reviews capability', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
      store.getCameraConfig.mockReturnValue(
        createCameraConfig({ media: { type: 'reviews' } }),
      );

      cameraManager.getCameraCapabilities.mockReturnValue(createCapabilities());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildDefaultCameraQuery();

      expect(query).toBeNull();
    });
  });

  describe('buildMediaQuery', () => {
    it('should build clips query', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.clips());

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasClip: true,
      });
    });

    it('should build snapshots query', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.snapshots());

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        hasSnapshot: true,
      });
    });

    it('should build recordings query', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.recordings());

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Recording });
    });

    it('should build reviews query', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.reviews());

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Review });
    });

    it('should use dependent cameras when cameraID provided', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getAllDependentCameras.mockReturnValue(new Set(['camera.office', 'dep1']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.clips(), {
        cameraID: 'camera.office',
      });

      assert(query);
      expect(store.getAllDependentCameras).toHaveBeenCalledWith(
        'camera.office',
        'clips',
      );
    });

    it('should apply limit option', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.recordings(), {
        limit: 30,
      });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Recording,
        limit: 30,
      });
    });

    it('should return null when no capable cameras', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set());

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery(MediaTypeSpec.clips());

      expect(query).toBeNull();
    });

    it('should return null for folder media type', () => {
      const { cameraManager, foldersManager } = createMocks();

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery({ mediaType: 'folder' });

      expect(query).toBeNull();
    });

    it('should handle events without subtype', () => {
      const { cameraManager, foldersManager, store } = createMocks();
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['camera.office']));

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildCameraMediaQuery({ mediaType: 'events' });

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Event });
      expect(query.getNodes()[0]).not.toHaveProperty('hasClip');
      expect(query.getNodes()[0]).not.toHaveProperty('hasSnapshot');

      expect(store.getCameraIDsWithCapability).toHaveBeenCalledWith({
        anyCapabilities: ['clips', 'snapshots'],
      });
    });
  });

  describe('default parameters merging', () => {
    it('should merge what/where from multiple cameras', () => {
      const { cameraManager, foldersManager } = createMocks();
      cameraManager.getDefaultQueryParameters.mockImplementation((id) => {
        if (id === 'camera.office') {
          return { what: new Set(['person']) };
        }
        if (id === 'cam2') {
          return { what: new Set(['car']), where: new Set(['driveway']) };
        }
        return {};
      });

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildClipsQuery(new Set(['camera.office', 'cam2']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({
        type: QueryType.Event,
        what: new Set(['person', 'car']),
        where: new Set(['driveway']),
      });
    });

    it('should not include what/where when empty', () => {
      const { cameraManager, foldersManager } = createMocks();

      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildClipsQuery(new Set(['camera.office']));

      assert(query);
      expect(query.getNodes()[0]).toMatchObject({ type: QueryType.Event });

      expect(query.getNodes()[0]).not.toHaveProperty('what');
      expect(query.getNodes()[0]).not.toHaveProperty('where');
    });
  });
});
