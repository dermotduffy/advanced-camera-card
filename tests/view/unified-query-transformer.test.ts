import { assert, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../src/camera-manager/manager';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { UnifiedQueryBuilder } from '../../src/view/unified-query-builder';
import { UnifiedQueryTransformer } from '../../src/view/unified-query-transformer';
import {
  createCapabilities,
  createFolder,
  isEventQuery,
  isFolderQuery,
  isRecordingQuery,
} from '../test-utils';

const createMocks = () => {
  const cameraManager = mock<CameraManager>();
  const foldersManager = mock<FoldersManager>();
  const store = mock<CameraManagerStore>();

  cameraManager.getStore.mockReturnValue(store);
  store.getCameraIDs.mockReturnValue(new Set(['camera.office']));
  store.getAllDependentCameras.mockImplementation((id) => new Set([id]));
  cameraManager.getCameraCapabilities.mockReturnValue(
    createCapabilities({ clips: true, snapshots: true, recordings: true }),
  );

  return { cameraManager, foldersManager, store };
};

describe('UnifiedQueryTransformer', () => {
  describe('stripTimeRange', () => {
    it('should remove start and end from camera queries', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildClipsQuery(new Set(['camera.office']), {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
        limit: 10,
      });
      assert(query);

      const stripped = UnifiedQueryTransformer.stripTimeRange(query);
      const node = stripped.getNodes()[0];
      assert(isEventQuery(node));

      expect(node).not.toHaveProperty('start');
      expect(node).not.toHaveProperty('end');
      expect(node.limit).toBe(10); // Other props preserved
    });

    it('should not affect folder queries', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const folder = createFolder({ id: 'f1', title: 'Test' });
      const query = builder.buildFolderQueryWithPath(folder, [{ ha: { id: 'Root' } }]);

      const stripped = UnifiedQueryTransformer.stripTimeRange(query);
      const node = stripped.getNodes()[0];
      assert(isFolderQuery(node));
      expect(node.folder.id).toBe('f1');
    });
  });

  describe('rebuildQuery', () => {
    it('should apply new options to camera queries', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildClipsQuery(new Set(['camera.office']));
      assert(query);

      const start = new Date('2024-06-01');
      const end = new Date('2024-06-02');

      const rebuilt = UnifiedQueryTransformer.rebuildQuery(query, {
        start,
        end,
        limit: 100,
      });

      const node = rebuilt.getNodes()[0];
      assert(isEventQuery(node));
      expect(node.start).toEqual(start);
      expect(node.end).toEqual(end);
      expect(node.limit).toBe(100);
    });

    it('should not affect folder queries', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const folder = createFolder({ id: 'f1', title: 'Test' });
      const query = builder.buildFolderQueryWithPath(folder, [{ ha: { id: 'Root' } }]);

      const rebuilt = UnifiedQueryTransformer.rebuildQuery(query, {
        start: new Date(),
        end: new Date(),
      });

      const node = rebuilt.getNodes()[0];
      assert(isFolderQuery(node));
      expect(node).not.toHaveProperty('start');
      expect(node).not.toHaveProperty('end');
    });
  });

  describe('convertToClips', () => {
    it('should convert event query to clips', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildSnapshotsQuery(new Set(['camera.office']));
      assert(query);

      const converted = UnifiedQueryTransformer.convertToClips(query);
      const node = converted.getNodes()[0];
      assert(isEventQuery(node));

      expect(node.hasClip).toBe(true);
      expect(node.hasSnapshot).toBeUndefined();
    });

    it('should not affect recording queries', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const query = builder.buildRecordingsQuery(new Set(['camera.office']));
      assert(query);

      const converted = UnifiedQueryTransformer.convertToClips(query);
      const node = converted.getNodes()[0];
      assert(isRecordingQuery(node));
      expect(node).not.toHaveProperty('hasClip');
    });

    it('should not affect folder queries', () => {
      const { cameraManager, foldersManager } = createMocks();
      const builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
      const folder = createFolder({ id: 'f1', title: 'Test' });
      const query = builder.buildFolderQueryWithPath(folder, [{ ha: { id: 'Root' } }]);

      const converted = UnifiedQueryTransformer.convertToClips(query);
      const node = converted.getNodes()[0];
      assert(isFolderQuery(node));
      expect(node.folder.id).toBe('f1');
    });
  });
});
