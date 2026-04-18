import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ViewItemManager } from '../../src/card-controller/view/item-manager';
import { RemoveContextViewModifier } from '../../src/card-controller/view/modifiers/remove-context';
import { ViewManagerEpoch } from '../../src/card-controller/view/types';
import { ViewManager } from '../../src/card-controller/view/view-manager';
import {
  downloadMedia,
  navigateToTimeline,
  toggleFavorite,
  toggleReviewed,
} from '../../src/utils/media-actions';
import { ViewItem, ViewMediaType } from '../../src/view/item';
import { QueryResults } from '../../src/view/query-results';
import { View } from '../../src/view/view';
import { TestViewMedia } from '../test-utils';

describe('MediaActions', () => {
  describe('toggleReviewed', () => {
    it('should return false if item is not review', async () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });
      const viewItemManager = mock<ViewItemManager>();

      expect(await toggleReviewed(item, viewItemManager)).toBe(false);
    });

    it('should return false if manager is missing', async () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Review });

      expect(await toggleReviewed(item)).toBe(false);
    });

    it('should toggle review status and update view', async () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        reviewed: false,
      });
      const viewItemManager = mock<ViewItemManager>();
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      const viewManager = mock<ViewManager>();
      const view = mock<View>();
      const queryResults = mock<QueryResults>();

      viewManagerEpoch.manager = viewManager;
      viewManager.getView.mockReturnValue(view);
      view.queryResults = queryResults;
      queryResults.clone.mockReturnValue(queryResults);
      queryResults.removeItem.mockReturnValue(queryResults);

      expect(await toggleReviewed(item, viewItemManager, viewManagerEpoch, false)).toBe(
        true,
      );
      expect(viewItemManager.reviewMedia).toHaveBeenCalledWith(item, true);
      expect(item.isReviewed()).toBe(true);
      expect(viewManager.setViewByParameters).toHaveBeenCalled();
    });

    it('should not update view if queryResults is missing', async () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        reviewed: false,
      });
      const viewItemManager = mock<ViewItemManager>();
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      const viewManager = mock<ViewManager>();
      const view = mock<View>();

      viewManagerEpoch.manager = viewManager;
      viewManager.getView.mockReturnValue(view);
      view.queryResults = null;

      expect(await toggleReviewed(item, viewItemManager, viewManagerEpoch, false)).toBe(
        true,
      );
      expect(viewManager.setViewByParameters).not.toHaveBeenCalled();
    });

    it('should handle manager error', async () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Review,
        reviewed: false,
      });
      const viewItemManager = mock<ViewItemManager>();
      const error = new Error('fail');
      viewItemManager.reviewMedia.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await toggleReviewed(item, viewItemManager)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(error.message);

      consoleSpy.mockRestore();
    });
  });

  describe('toggleFavorite', () => {
    it('should return false if item is not media', async () => {
      const viewItemManager = mock<ViewItemManager>();

      expect(await toggleFavorite(null as unknown as ViewItem, viewItemManager)).toBe(
        false,
      );
    });

    it('should return false if manager is missing', async () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });

      expect(await toggleFavorite(item)).toBe(false);
    });

    it('should toggle favorite status', async () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        favorite: false,
      });
      const viewItemManager = mock<ViewItemManager>();

      expect(await toggleFavorite(item, viewItemManager)).toBe(true);
      expect(viewItemManager.favorite).toHaveBeenCalledWith(item, true);
    });

    it('should handle manager error', async () => {
      const item = new TestViewMedia({
        mediaType: ViewMediaType.Clip,
        favorite: false,
      });
      const viewItemManager = mock<ViewItemManager>();
      const error = new Error('fail');
      viewItemManager.favorite.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await toggleFavorite(item, viewItemManager)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(error.message);

      consoleSpy.mockRestore();
    });
  });

  describe('downloadMedia', () => {
    it('should return false if manager is missing', async () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });

      expect(await downloadMedia(item)).toBe(false);
    });

    it('should download media', async () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });
      const viewItemManager = mock<ViewItemManager>();

      expect(await downloadMedia(item, viewItemManager)).toBe(true);
      expect(viewItemManager.download).toHaveBeenCalledWith(item);
    });

    it('should handle manager error', async () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });
      const viewItemManager = mock<ViewItemManager>();
      const error = new Error('fail');
      viewItemManager.download.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await downloadMedia(item, viewItemManager)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(error.message);

      consoleSpy.mockRestore();
    });
  });

  describe('navigateToTimeline', () => {
    it('should return early if epoch is missing', () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });

      expect(navigateToTimeline(item)).toBeUndefined();
    });

    it('should navigate to timeline with correct parameters', () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      const viewManager = mock<ViewManager>();
      const view = mock<View>();
      const queryResults = mock<QueryResults>();

      viewManagerEpoch.manager = viewManager;
      viewManager.getView.mockReturnValue(view);
      view.queryResults = queryResults;
      queryResults.clone.mockReturnValue(queryResults);

      // Make selectResultIfFound call the predicate to gain coverage.
      queryResults.selectResultIfFound.mockImplementation((predicate) => {
        predicate(item);
        return queryResults;
      });

      navigateToTimeline(item, viewManagerEpoch);

      expect(viewManager.setViewByParameters).toHaveBeenCalledWith({
        params: {
          view: 'timeline',
          queryResults: queryResults,
        },
        modifiers: [expect.any(RemoveContextViewModifier)],
      });
    });

    it('should handle missing view/queryResults during navigation', () => {
      const item = new TestViewMedia({ mediaType: ViewMediaType.Clip });
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      const viewManager = mock<ViewManager>();

      viewManagerEpoch.manager = viewManager;
      viewManager.getView.mockReturnValue(null);

      navigateToTimeline(item, viewManagerEpoch);

      expect(viewManager.setViewByParameters).toHaveBeenCalledWith({
        params: {
          view: 'timeline',
          queryResults: undefined,
        },
        modifiers: [new RemoveContextViewModifier(['timeline'])],
      });
    });
  });
});
