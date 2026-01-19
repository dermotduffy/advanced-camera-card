import { assert, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../src/camera-manager/manager';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { ConditionStateManagerReadonlyInterface } from '../../src/conditions/types';
import { QuerySource } from '../../src/query-source';
import { ViewMedia } from '../../src/view/item';
import { UnifiedQuery } from '../../src/view/unified-query';
import { UnifiedQueryRunner } from '../../src/view/unified-query-runner';
import { createEventQuery, createFolderQuery } from '../test-utils';

describe('UnifiedQueryRunner', () => {
  describe('execute', () => {
    it('should aggregate results from camera and folder sources', async () => {
      const cameraManager = mock<CameraManager>();
      const foldersManager = mock<FoldersManager>();
      const conditionStateManager = mock<ConditionStateManagerReadonlyInterface>();

      const runner = new UnifiedQueryRunner(
        cameraManager,
        foldersManager,
        conditionStateManager,
      );

      const cameraItem = mock<ViewMedia>();
      const folderItem = mock<ViewMedia>();

      cameraManager.executeMediaQueries.mockResolvedValue([cameraItem]);
      foldersManager.expandFolder.mockResolvedValue([folderItem]);

      const query = new UnifiedQuery();
      query.addNode(createEventQuery('camera1'));
      query.addNode(createFolderQuery('f1'));

      const results = await runner.execute(query);

      expect(results).toHaveLength(2);
      expect(results).toContain(cameraItem);
      expect(results).toContain(folderItem);

      expect(cameraManager.executeMediaQueries).toHaveBeenCalledWith(
        [expect.objectContaining({ source: QuerySource.Camera })],
        expect.anything(),
      );
      expect(foldersManager.expandFolder).toHaveBeenCalledWith(
        expect.objectContaining({ source: QuerySource.Folder }),
        undefined,
        expect.objectContaining({ useCache: undefined }),
      );
    });

    it('should handle empty query gracefully', async () => {
      const cameraManager = mock<CameraManager>();
      const foldersManager = mock<FoldersManager>();
      const runner = new UnifiedQueryRunner(
        cameraManager,
        foldersManager,
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const results = await runner.execute(new UnifiedQuery());
      expect(results).toHaveLength(0);
      expect(cameraManager.executeMediaQueries).not.toHaveBeenCalled();
      expect(foldersManager.expandFolder).not.toHaveBeenCalled();
    });

    it('should handle null returns from managers', async () => {
      const cameraManager = mock<CameraManager>();
      const foldersManager = mock<FoldersManager>();
      const runner = new UnifiedQueryRunner(
        cameraManager,
        foldersManager,
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      cameraManager.executeMediaQueries.mockResolvedValue(null);
      foldersManager.expandFolder.mockResolvedValue(null);

      const query = new UnifiedQuery();
      query.addNode(createEventQuery('camera1'));
      query.addNode(createFolderQuery('f1'));

      const results = await runner.execute(query);

      expect(results).toHaveLength(0);
    });

    it('should pass options to managers', async () => {
      const cameraManager = mock<CameraManager>();
      const runner = new UnifiedQueryRunner(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const query = new UnifiedQuery();
      query.addNode(createEventQuery('camera1'));

      await runner.execute(query, { useCache: false });

      expect(cameraManager.executeMediaQueries).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ useCache: false }),
      );
    });
  });

  describe('areResultsFresh', () => {
    it('should return true if managers report fresh', () => {
      const cameraManager = mock<CameraManager>();
      const foldersManager = mock<FoldersManager>();
      cameraManager.areMediaQueriesResultsFresh.mockReturnValue(true);
      foldersManager.areResultsFresh.mockReturnValue(true);

      const runner = new UnifiedQueryRunner(
        cameraManager,
        foldersManager,
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const query = new UnifiedQuery();
      query.addNode(createEventQuery('camera1'));
      query.addNode(createFolderQuery('f1'));

      expect(runner.areResultsFresh(new Date(), query)).toBe(true);
    });

    it('should return false if any manager reports stale', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.areMediaQueriesResultsFresh.mockReturnValue(false);

      const runner = new UnifiedQueryRunner(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const query = new UnifiedQuery([createEventQuery('camera1')]);
      expect(runner.areResultsFresh(new Date(), query)).toBe(false);
    });

    it('should return false if folder manager reports stale', () => {
      const foldersManager = mock<FoldersManager>();
      foldersManager.areResultsFresh.mockReturnValue(false);

      const runner = new UnifiedQueryRunner(
        mock<CameraManager>(),
        foldersManager,
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const query = new UnifiedQuery([createFolderQuery('f1')]);
      expect(runner.areResultsFresh(new Date(), query)).toBe(false);
    });
  });

  describe('extend', () => {
    it('should extend media queries and preserve folder queries', async () => {
      const cameraManager = mock<CameraManager>();
      const runner = new UnifiedQueryRunner(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const existingItem = mock<ViewMedia>();
      const newItem = mock<ViewMedia>();
      const extendedMediaMatch = createEventQuery('camera1');

      cameraManager.extendMediaQueries.mockResolvedValue({
        queries: [extendedMediaMatch],
        results: [existingItem, newItem],
      });

      const query = new UnifiedQuery();
      query.addNode(createEventQuery('camera1'));
      query.addNode(createFolderQuery('f1'));

      const result = await runner.extend(query, [existingItem], 'later');

      assert(result);
      expect(result.results).toHaveLength(2);
      expect(result.query.getNodeCount()).toBe(2);
      expect(result.query.getMediaQueries()).toHaveLength(1);
      expect(result.query.getFolderQueries()).toHaveLength(1);

      expect(cameraManager.extendMediaQueries).toHaveBeenCalledWith(
        [expect.objectContaining({ source: QuerySource.Camera })],
        [existingItem],
        'later',
        expect.anything(),
      );
    });

    it('should return null for query with no media nodes', async () => {
      const runner = new UnifiedQueryRunner(
        mock<CameraManager>(),
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const query = new UnifiedQuery([createFolderQuery('f1')]);
      const result = await runner.extend(query, [], 'earlier');

      expect(result).toBeNull();
    });

    it('should return null if camera manager fails to extend', async () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.extendMediaQueries.mockResolvedValue(null);

      const runner = new UnifiedQueryRunner(
        cameraManager,
        mock<FoldersManager>(),
        mock<ConditionStateManagerReadonlyInterface>(),
      );

      const query = new UnifiedQuery([createEventQuery('camera1')]);
      const result = await runner.extend(query, [], 'earlier');

      expect(result).toBeNull();
    });
  });
});
