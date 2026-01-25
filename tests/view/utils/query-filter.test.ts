import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ViewFolder } from '../../../src/view/item';
import { UnifiedQuery } from '../../../src/view/unified-query';
import {
  getReviewedQueryFilterFromConfig,
  getReviewedQueryFilterFromQuery,
} from '../../../src/view/utils/query-filter';
import { createEventQuery, createFolder, TestViewMedia } from '../../test-utils';

describe('query-filter', () => {
  describe('getReviewedQueryFilterFromQuery', () => {
    it('should return undefined if query is missing', () => {
      expect(getReviewedQueryFilterFromQuery(null)).toBeUndefined();
    });

    it('should return undefined if item is missing', () => {
      expect(getReviewedQueryFilterFromQuery(mock<UnifiedQuery>())).toBeUndefined();
    });

    it('should return undefined if item is not media', () => {
      const query = mock<UnifiedQuery>();
      const item = new ViewFolder(createFolder(), []);

      expect(getReviewedQueryFilterFromQuery(query, item)).toBeUndefined();
    });

    it('should return undefined if item has no cameraID', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: null });

      expect(getReviewedQueryFilterFromQuery(query, item)).toBeUndefined();
    });

    it('should return undefined if zero or multiple media queries match', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([]);
      expect(getReviewedQueryFilterFromQuery(query, item)).toBeUndefined();

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1'),
        createEventQuery('camera-2'),
      ]);
      expect(getReviewedQueryFilterFromQuery(query, item)).toBeUndefined();
    });

    it('should return boolean if exactly one media query matches', () => {
      const query = mock<UnifiedQuery>();
      const item = new TestViewMedia({ cameraID: 'camera-1' });

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { reviewed: true }),
      ]);
      expect(getReviewedQueryFilterFromQuery(query, item)).toBe(true);

      query.getMediaQueries.mockReturnValue([
        createEventQuery('camera-1', { reviewed: false }),
      ]);
      expect(getReviewedQueryFilterFromQuery(query, item)).toBe(false);

      query.getMediaQueries.mockReturnValue([createEventQuery('camera-1')]);
      expect(getReviewedQueryFilterFromQuery(query, item)).toBeUndefined();
    });
  });

  describe('getReviewedQueryFilterFromConfig', () => {
    it('should return true for reviewed', () => {
      expect(getReviewedQueryFilterFromConfig('reviewed')).toBe(true);
    });

    it('should return undefined for all', () => {
      expect(getReviewedQueryFilterFromConfig('all')).toBeUndefined();
      expect(getReviewedQueryFilterFromConfig(undefined)).toBe(false);
    });

    it('should return false for unreviewed', () => {
      expect(getReviewedQueryFilterFromConfig('unreviewed')).toBe(false);
    });
  });
});
