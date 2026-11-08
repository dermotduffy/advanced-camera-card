import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { ViewFolder } from '../../../src/view/item';
import type { UnifiedQuery } from '../../../src/view/unified-query';
import {
  getBooleanQueryFilter,
  getReviewedQueryFilterFromConfig,
} from '../../../src/view/utils/query-filter';
import { createFolder } from '../../test-utils';
import { createEventQuery, TestViewMedia } from '../test-utils';

describe('query-filter', () => {
  describe('getBooleanQueryFilter for reviewed', () => {
    it('should return null if query is missing', () => {
      expect(getBooleanQueryFilter('reviewed', null)).toBeNull();
    });

    it('should return null if item is missing', () => {
      expect(getBooleanQueryFilter('reviewed', mock<UnifiedQuery>())).toBeNull();
    });

    it('should return null if item is not media', () => {
      const query = mock<UnifiedQuery>();
      const item = new ViewFolder(createFolder(), []);

      expect(getBooleanQueryFilter('reviewed', query, item)).toBeNull();
    });

    it('should return null if item has no cameraID', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: null });

      expect(getBooleanQueryFilter('reviewed', query, item)).toBeNull();
    });

    it('should return null when no media query sets the filter', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([]);
      expect(getBooleanQueryFilter('reviewed', query, item)).toBeNull();

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1'),
        createEventQuery('camera-2'),
      ]);
      expect(getBooleanQueryFilter('reviewed', query, item)).toBeNull();
    });

    it('should return the filter from a single media query', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { reviewed: true }),
      ]);
      expect(getBooleanQueryFilter('reviewed', query, item)).toBe(true);

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { reviewed: false }),
      ]);
      expect(getBooleanQueryFilter('reviewed', query, item)).toBe(false);

      query.getMediaQueries.mockReturnValue([createEventQuery('camera-1')]);
      expect(getBooleanQueryFilter('reviewed', query, item)).toBeNull();
    });
  });

  describe('getBooleanQueryFilter for favorite', () => {
    it('should return the filter from a single media query', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { favorite: true }),
      ]);
      expect(getBooleanQueryFilter('favorite', query, item)).toBe(true);

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { favorite: false }),
      ]);
      expect(getBooleanQueryFilter('favorite', query, item)).toBe(false);

      query.getMediaQueries.mockReturnValue([createEventQuery('camera-1')]);
      expect(getBooleanQueryFilter('favorite', query, item)).toBeNull();
    });

    it('should return null without a query', () => {
      expect(getBooleanQueryFilter('favorite', null)).toBeNull();
    });

    it('should return the filter when multiple media queries agree', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { favorite: true }),
        createEventQuery('camera-1', { favorite: true }),
      ]);

      expect(getBooleanQueryFilter('favorite', query, item)).toBe(true);
    });

    it('should return null when media queries disagree', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { favorite: true }),
        createEventQuery('camera-1', { favorite: false }),
      ]);

      expect(getBooleanQueryFilter('favorite', query, item)).toBeNull();
    });
  });

  describe('getReviewedQueryFilterFromConfig', () => {
    it('should return true for reviewed', () => {
      expect(getReviewedQueryFilterFromConfig('reviewed')).toBe(true);
    });

    it('should return undefined for all', () => {
      expect(getReviewedQueryFilterFromConfig('all')).toBeUndefined();
    });

    it('should return false for unreviewed', () => {
      expect(getReviewedQueryFilterFromConfig('unreviewed')).toBe(false);
    });

    it('should return false without a config value', () => {
      expect(getReviewedQueryFilterFromConfig(undefined)).toBe(false);
    });
  });
});
