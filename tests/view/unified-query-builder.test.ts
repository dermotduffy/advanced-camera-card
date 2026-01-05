import { assert, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../src/camera-manager/manager';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { QueryType } from '../../src/camera-manager/types';
import { FolderPathComponent } from '../../src/card-controller/folders/types';
import { FolderConfig } from '../../src/config/schema/folders';
import { QuerySource } from '../../src/query-source';
import {
  UnifiedQueryBuilder,
  UnifiedQueryTransformer,
} from '../../src/view/unified-query-builder';
import {
  isEventQuery,
  isFolderQuery,
  isRecordingQuery,
  isReviewQuery,
} from '../test-utils';

describe('UnifiedQueryBuilder', () => {
  describe('Event Queries', () => {
    it('should return null if no camera IDs provided', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildClipsQuery(new Set());
      expect(query).toBeNull();
    });

    it('should build clips query', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockReturnValue({});

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildClipsQuery(new Set(['camera1']));

      assert(query);
      const nodes = query.getNodes();
      expect(nodes).toHaveLength(1);
      const node = nodes[0];
      assert(isEventQuery(node));

      expect(node.source).toBe(QuerySource.Camera);
      expect(node.type).toBe(QueryType.Event);
      expect(node.hasClip).toBe(true);
      expect(node.hasSnapshot).toBeUndefined();
    });

    it('should build snapshots query', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockReturnValue({});

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildSnapshotsQuery(new Set(['camera1']));

      assert(query);
      const node = query.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.hasSnapshot).toBe(true);
      expect(node.hasClip).toBeUndefined();
    });

    it('should build events query (both)', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockReturnValue({});

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildEventsQuery(new Set(['camera1']));

      assert(query);
      const node = query.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.hasClip).toBeUndefined();
      expect(node.hasSnapshot).toBeUndefined();
    });

    it('should apply window to event query', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockReturnValue({});

      const start = new Date('2023-01-01');
      const end = new Date('2023-01-02');

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildClipsQuery(new Set(['camera1']), {
        start,
        end,
      });

      assert(query);
      const node = query.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.start).toEqual(start);
      expect(node.end).toEqual(end);
    });
  });

  describe('Recording Queries', () => {
    it('should build recordings query', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockReturnValue({});

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildRecordingsQuery(new Set(['camera1']));

      assert(query);
      const node = query.getNodes()[0];
      assert(isRecordingQuery(node));

      expect(node.type).toBe(QueryType.Recording);
    });

    it('should return null if no camera IDs provided', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildRecordingsQuery(new Set());
      expect(query).toBeNull();
    });
  });

  describe('Review Queries', () => {
    it('should build reviews query', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockReturnValue({});

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildReviewsQuery(new Set(['camera1']), { reviewed: true });

      assert(query);
      const node = query.getNodes()[0];
      assert(isReviewQuery(node));

      expect(node.type).toBe(QueryType.Review);
      expect(node.reviewed).toBe(true);
    });

    it('should return null if no camera IDs provided', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildReviewsQuery(new Set());
      expect(query).toBeNull();
    });
  });

  describe('Folder Queries', () => {
    it('should build folder query', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const folder: FolderConfig = { type: 'ha', id: 'folder1', title: 'My Folder' };
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      const query = builder.buildFolderQuery(folder, path);

      expect(query).toBeDefined();
      const nodes = query.getNodes();
      expect(nodes).toHaveLength(1);
      const node = nodes[0];
      assert(isFolderQuery(node));

      expect(node.source).toBe(QuerySource.Folder);
      expect(node.folder).toBe(folder);
      expect(node.path).toBe(path);
    });

    it('should apply limit option to folder query', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const folder: FolderConfig = { type: 'ha', id: 'folder1', title: 'My Folder' };
      const path: [FolderPathComponent] = [{ ha: { id: 'Root' } }];

      const query = builder.buildFolderQuery(folder, path, { limit: 10 });

      const node = query.getNodes()[0];
      assert(isFolderQuery(node));

      expect(node.limit).toBe(10);
    });
  });

  describe('buildFilterQuery', () => {
    it('should build filter query with defaults', () => {
      const cameraManager = mock<CameraManager>();
      const store = mock<CameraManagerStore>();
      cameraManager.getStore.mockReturnValue(store);
      store.getCameraIDsWithCapability.mockReturnValue(new Set(['office']));
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildFilterQuery(null, null);

      assert(query);

      // clips, snapshots, recordings, reviews
      expect(query.getMediaQueries()).toHaveLength(4);
      expect(query.getAllCameraIDs().has('office')).toBe(true);
    });

    it('should build filter query with specific cameras and types', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildFilterQuery(
        new Set(['office']),
        new Set(['clips', 'recordings']),
      );

      assert(query);
      expect(query.getMediaQueries()).toHaveLength(2);
      expect(query.hasMediaQueriesOfType(QueryType.Event)).toBe(true);
      expect(query.hasMediaQueriesOfType(QueryType.Recording)).toBe(true);
    });

    it('should apply all filter options', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const start = new Date('2024-01-01');
      const tags = new Set(['tag1']);
      const query = builder.buildFilterQuery(new Set(['office']), new Set(['clips']), {
        start,
        limit: 5,
        favorite: true,
        tags,
        reviewed: false,
      });

      assert(query);
      const node = query.getMediaQueries()[0];
      assert(isEventQuery(node));
      expect(node.start).toEqual(start);
      expect(node.limit).toBe(5);
      expect(node.favorite).toBe(true);
      expect(node.tags).toEqual(tags);
    });

    it('should return null if no nodes are added', () => {
      const cameraManager = mock<CameraManager>();
      const store = mock<CameraManagerStore>();
      cameraManager.getStore.mockReturnValue(store);
      store.getCameraIDsWithCapability.mockReturnValue(new Set());
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildFilterQuery(new Set(), null);
      expect(query).toBeNull();
    });
  });

  describe('should apply default parameters', () => {
    it('should merge defaults from multiple cameras', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getDefaultQueryParameters.mockImplementation((id) => {
        if (id === 'camera1') {
          return { what: new Set(['person']) };
        }
        if (id === 'camera2') {
          return { what: new Set(['car']), where: new Set(['driveway']) };
        }
        return {};
      });

      const builder = new UnifiedQueryBuilder(cameraManager);
      const query = builder.buildClipsQuery(new Set(['camera1', 'camera2']));

      assert(query);
      const node = query.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.what).toEqual(new Set(['person', 'car']));
      expect(node.where).toEqual(new Set(['driveway']));
    });
  });
});

describe('UnifiedQueryTransformer', () => {
  describe('rebuildQuery', () => {
    it('should apply options to existing query', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildClipsQuery(new Set(['camera1']));
      assert(query);
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');
      const limit = 50;

      const modified = UnifiedQueryTransformer.rebuildQuery(query, {
        start,
        end,
        limit,
      });

      const node = modified.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.start).toEqual(start);
      expect(node.end).toEqual(end);
      expect(node.limit).toEqual(limit);
    });

    it('should NOT affect folder queries', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const folder: FolderConfig = { type: 'ha', id: 'folder1', title: 'My Folder' };
      const query = builder.buildFolderQuery(folder, [{ ha: { id: 'Root' } }]);
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');

      const modified = UnifiedQueryTransformer.rebuildQuery(query, { start, end });

      const node = modified.getNodes()[0];
      assert(isFolderQuery(node));

      expect(node).not.toHaveProperty('start');
      expect(node).not.toHaveProperty('end');
    });
  });

  describe('stripTimeRange', () => {
    it('should remove start and end from camera queries', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildClipsQuery(new Set(['camera1']), {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      });
      assert(query);

      const stripped = UnifiedQueryTransformer.stripTimeRange(query);

      const node = stripped.getNodes()[0];
      assert(isEventQuery(node));

      expect(node).not.toHaveProperty('start');
      expect(node).not.toHaveProperty('end');
    });

    it('should NOT affect folder queries', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const folder: FolderConfig = { type: 'ha', id: 'folder1', title: 'My Folder' };
      const query = builder.buildFolderQuery(folder, [{ ha: { id: 'Root' } }]);

      const stripped = UnifiedQueryTransformer.stripTimeRange(query);

      const node = stripped.getNodes()[0];
      assert(isFolderQuery(node));

      // Folder queries don't have start/end, so just verify it's unchanged
      expect(node.folder.id).toBe('folder1');
    });
  });

  describe('convertToClips', () => {
    it('should convert snapshots query to clips query', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildSnapshotsQuery(new Set(['camera1']));
      assert(query);

      const converted = UnifiedQueryTransformer.convertToClips(query);

      const node = converted.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.hasClip).toBe(true);
      expect(node.hasSnapshot).toBeUndefined();
    });

    it('should NOT affect non-event queries', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const query = builder.buildRecordingsQuery(new Set(['camera1']));
      assert(query);

      const converted = UnifiedQueryTransformer.convertToClips(query);

      const node = converted.getNodes()[0];
      assert(isRecordingQuery(node));

      expect(node).not.toHaveProperty('hasClip');
    });

    it('should NOT affect folder queries', () => {
      const cameraManager = mock<CameraManager>();
      const builder = new UnifiedQueryBuilder(cameraManager);

      const folder: FolderConfig = { type: 'ha', id: 'folder1', title: 'My Folder' };
      const query = builder.buildFolderQuery(folder, [{ ha: { id: 'Root' } }]);

      const converted = UnifiedQueryTransformer.convertToClips(query);

      const node = converted.getNodes()[0];
      assert(isFolderQuery(node));

      expect(node.folder.id).toBe('folder1');
    });
  });
});
