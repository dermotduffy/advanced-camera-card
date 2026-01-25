import { assert, describe, expect, it } from 'vitest';
import { QueryType } from '../../src/camera-manager/types';
import { QuerySource } from '../../src/query-source';
import { UnifiedQuery } from '../../src/view/unified-query';
import {
  createEventQuery,
  createFolderQuery,
  createRecordingQuery,
  createReviewQuery,
  isEventQuery,
  isFolderQuery,
} from '../test-utils';

describe('UnifiedQuery', () => {
  describe('Node Management', () => {
    it('should construct empty', () => {
      const query = new UnifiedQuery();
      expect(query.hasNodes()).toBe(false);
    });

    it('should construct with initial nodes', () => {
      const nodes = [createEventQuery('front')];
      const query = new UnifiedQuery(nodes);
      expect(query.hasNodes()).toBe(true);
    });

    it('should add node', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));
      expect(query.getMediaQueries()).toHaveLength(1);
    });

    it('should allow multiple nodes for same camera', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));
      query.addNode(createReviewQuery('front'));
      query.addNode(createRecordingQuery('front'));
      expect(query.getMediaQueries()).toHaveLength(3);
    });
  });

  describe('Lookup Methods', () => {
    it('should get queries by folder', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));
      query.addNode(createFolderQuery('clips'));
      query.addNode(createFolderQuery('recordings'));

      const clipsQueries = query.getFolderQueries('clips');
      expect(clipsQueries).toHaveLength(1);
    });

    it('should get all media types', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front', { hasClip: true }));
      query.addNode(createEventQuery('back', { hasSnapshot: true }));
      query.addNode(createRecordingQuery('garage'));
      query.addNode(createReviewQuery('office'));

      const types = query.getAllMediaTypes();
      expect(types.size).toBe(4);
      expect(types.has('clips')).toBe(true);
      expect(types.has('snapshots')).toBe(true);
      expect(types.has('recordings')).toBe(true);
      expect(types.has('reviews')).toBe(true);
    });

    it('should ignore non-media nodes in getAllMediaTypes', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front', { hasClip: true }));
      query.addNode(createFolderQuery('clips'));

      const types = query.getAllMediaTypes();
      expect(types.size).toBe(1);
      expect(types.has('clips')).toBe(true);
    });

    it('should ignore unhandled media types in getAllMediaTypes', () => {
      const query = new UnifiedQuery();
      query.addNode({
        source: QuerySource.Camera,
        type: QueryType.RecordingSegments,
        cameraIDs: new Set(['camera1']),
      });

      const types = query.getAllMediaTypes();
      expect(types.size).toBe(0);
    });

    it('should filter media queries by camera ID', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));
      query.addNode(createEventQuery('back'));

      expect(query.getMediaQueries({ cameraID: 'front' })).toHaveLength(1);
      expect(query.getMediaQueries({ cameraID: 'garage' })).toHaveLength(0);
    });

    it('should filter media queries by type', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));
      query.addNode(createRecordingQuery('front'));

      expect(query.getMediaQueries({ type: QueryType.Event })).toHaveLength(1);
      expect(query.getMediaQueries({ type: QueryType.Recording })).toHaveLength(1);
    });

    it('should check hasMediaQueriesOfType', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));

      expect(query.hasMediaQueriesOfType(QueryType.Event)).toBe(true);
      expect(query.hasMediaQueriesOfType(QueryType.Review)).toBe(false);
    });
  });

  describe('Camera Operations', () => {
    it('should get all camera IDs', () => {
      const query = new UnifiedQuery();
      query.addNode(createEventQuery('front'));
      query.addNode(createReviewQuery('back'));
      query.addNode(createFolderQuery('clips'));

      const cameraIDs = query.getAllCameraIDs();
      expect(cameraIDs.size).toBe(2);
      expect(cameraIDs.has('front')).toBe(true);
      expect(cameraIDs.has('back')).toBe(true);
    });
  });

  describe('Clone', () => {
    it('should create deep clone', () => {
      const query = new UnifiedQuery();
      query.addNode(
        createEventQuery('front', {
          what: new Set(['person']),
          where: new Set(['driveway']),
        }),
      );

      const cloned = query.clone();

      // Modify original
      const originalEvent = query.getMediaQueries()[0];
      assert(isEventQuery(originalEvent));
      originalEvent.what?.add('car');

      // Clone should be unchanged
      const clonedEvent = cloned.getMediaQueries()[0];
      assert(isEventQuery(clonedEvent));
      expect(clonedEvent.what?.has('car')).toBe(false);
      expect(clonedEvent.what?.has('person')).toBe(true);
    });

    it('should clone path arrays', () => {
      const query = new UnifiedQuery();
      query.addNode(createFolderQuery('clips'));

      const cloned = query.clone();

      // Modify original
      const originalFolder = query.getFolderQueries()[0];
      assert(isFolderQuery(originalFolder));

      // We need to bypass readonly for testing the clone's independence
      (originalFolder as { path: unknown }).path = [
        ...originalFolder.path,
        { ha: { id: 'Child' } },
      ];

      // Clone should be unchanged
      const clonedFolder = cloned.getFolderQueries()[0];
      assert(isFolderQuery(clonedFolder));
      expect(clonedFolder.path).toHaveLength(1);
    });
  });

  describe('Equality', () => {
    it('should return true for equal queries', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(
        createEventQuery('front', {
          what: new Set(['person']),
        }),
      );

      const query2 = new UnifiedQuery();
      query2.addNode(
        createEventQuery('front', {
          what: new Set(['person']),
        }),
      );

      expect(query1.isEqual(query2)).toBe(true);
    });

    it('should return false for different node counts', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(createEventQuery('front'));

      const query2 = new UnifiedQuery();
      query2.addNode(createEventQuery('front'));
      query2.addNode(createEventQuery('back'));

      expect(query1.isEqual(query2)).toBe(false);
    });

    it('should return false for different node values', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(createEventQuery('front', { hasClip: true }));

      const query2 = new UnifiedQuery();
      query2.addNode(createEventQuery('front', { hasClip: false }));

      expect(query1.isEqual(query2)).toBe(false);
    });

    it('should handle Set comparison correctly', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(
        createEventQuery('front', {
          what: new Set(['person', 'car']),
        }),
      );

      const query2 = new UnifiedQuery();
      query2.addNode(
        createEventQuery('front', {
          what: new Set(['car', 'person']), // Same values, different order
        }),
      );

      expect(query1.isEqual(query2)).toBe(true);
    });
  });

  describe('isSupersetOf', () => {
    it('should return true for identical queries', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(createEventQuery('front'));

      const query2 = new UnifiedQuery();
      query2.addNode(createEventQuery('front'));

      expect(query1.isSupersetOf(query2)).toBe(true);
    });

    it('should return true when superset contains all nodes', () => {
      const superset = new UnifiedQuery();
      superset.addNode(createEventQuery('front'));
      superset.addNode(createEventQuery('back'));

      const subset = new UnifiedQuery();
      subset.addNode(createEventQuery('front'));

      expect(superset.isSupersetOf(subset)).toBe(true);
    });

    it('should return false when target has node not in source', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(createEventQuery('front'));

      const query2 = new UnifiedQuery();
      query2.addNode(createEventQuery('front'));
      query2.addNode(createEventQuery('back'));

      expect(query1.isSupersetOf(query2)).toBe(false);
    });

    it('should return true when time range is wider', () => {
      const superset = new UnifiedQuery();
      superset.addNode(
        createEventQuery('front', {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        }),
      );

      const subset = new UnifiedQuery();
      subset.addNode(
        createEventQuery('front', {
          start: new Date('2024-01-10'),
          end: new Date('2024-01-20'),
        }),
      );

      expect(superset.isSupersetOf(subset)).toBe(true);
    });

    it('should return false when superset time range is narrower', () => {
      const narrower = new UnifiedQuery();
      narrower.addNode(
        createEventQuery('front', {
          start: new Date('2024-01-10'),
          end: new Date('2024-01-20'),
        }),
      );

      const wider = new UnifiedQuery();
      wider.addNode(
        createEventQuery('front', {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        }),
      );

      expect(narrower.isSupersetOf(wider)).toBe(false);
    });

    it('should handle null times correctly', () => {
      const query1 = new UnifiedQuery();
      query1.addNode(createEventQuery('front'));

      const query2 = new UnifiedQuery();
      query2.addNode(createEventQuery('front'));

      expect(query1.isSupersetOf(query2)).toBe(true);
    });

    it('should return true for empty target query', () => {
      const superset = new UnifiedQuery();
      superset.addNode(createEventQuery('front'));

      const empty = new UnifiedQuery();

      expect(superset.isSupersetOf(empty)).toBe(true);
    });

    it('should support folder nodes', () => {
      const superset = new UnifiedQuery();
      superset.addNode(createFolderQuery('f1'));

      const subset = new UnifiedQuery();
      subset.addNode(createFolderQuery('f1'));

      expect(superset.isSupersetOf(subset)).toBe(true);

      const nonSubset = new UnifiedQuery();
      nonSubset.addNode(createFolderQuery('f2'));
      expect(superset.isSupersetOf(nonSubset)).toBe(false);
    });
  });
});
