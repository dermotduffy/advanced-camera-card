import { assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  ViewManagerEpoch,
  ViewManagerInterface,
} from '../../../src/card-controller/view/types';
import { GalleryController } from '../../../src/components-lib/gallery/controller';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../../src/config/schema/common/controls/thumbnails';
import { FolderConfig } from '../../../src/config/schema/folders';
import { MediaGalleryThumbnailsConfig } from '../../../src/config/schema/media-gallery';
import { ViewFolder, ViewItem, ViewMedia, ViewMediaType } from '../../../src/view/item';
import { QueryResults } from '../../../src/view/query-results';
import { UnifiedQuery } from '../../../src/view/unified-query';
import { UnifiedQueryRunner } from '../../../src/view/unified-query-runner';
import { View } from '../../../src/view/view';

// @vitest-environment jsdom
const createThumbnailConfig = (
  config?: Partial<MediaGalleryThumbnailsConfig>,
): MediaGalleryThumbnailsConfig => ({
  size: THUMBNAIL_WIDTH_DEFAULT,
  show_details: true,
  show_favorite_control: true,
  show_timeline_control: true,
  show_download_control: true,
  show_review_control: true,
  show_info_control: true,
  ...config,
});

describe('GalleryController', () => {
  it('should construct', () => {
    const host = document.createElement('div');
    const controller = new GalleryController(host);
    expect(controller).toBeTruthy();
    expect(controller.getItems()).toBeNull();
  });

  describe('setItemsFromView', () => {
    it('should set items from view', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const view = mock<View>();
      view.queryResults = mock<QueryResults>();
      const item1 = new ViewMedia(ViewMediaType.Clip);
      const item2 = new ViewMedia(ViewMediaType.Clip);

      vi.mocked(view.queryResults.getResults).mockReturnValue([item1, item2]);

      controller.setItemsFromView(view);

      // Items should be reversed (newest first)
      expect(controller.getItems()).toEqual([item2, item1]);
    });

    it('should handle null view or results', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);

      controller.setItemsFromView(null);
      expect(controller.getItems()).toBeNull();

      const view = mock<View>();
      view.queryResults = null;
      controller.setItemsFromView(view);
      expect(controller.getItems()).toBeNull();
    });

    it('should not update items if results are the same', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const view = mock<View>();
      view.queryResults = mock<QueryResults>();
      const item1 = new ViewMedia(ViewMediaType.Clip);

      vi.mocked(view.queryResults.getResults).mockReturnValue([item1]);

      controller.setItemsFromView(view);
      const itemsFirst = controller.getItems();

      // Second call with same results object
      controller.setItemsFromView(view, view);
      expect(controller.getItems()).toBe(itemsFirst);
    });

    it('should update items if results change', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const view1 = mock<View>();
      view1.queryResults = mock<QueryResults>();
      const item1 = new ViewMedia(ViewMediaType.Clip);
      vi.mocked(view1.queryResults.getResults).mockReturnValue([item1]);

      controller.setItemsFromView(view1);

      const view2 = mock<View>();
      view2.queryResults = mock<QueryResults>();
      const item2 = new ViewMedia(ViewMediaType.Clip);
      vi.mocked(view2.queryResults.getResults).mockReturnValue([item2]);

      controller.setItemsFromView(view2, view1);
      expect(controller.getItems()).toEqual([item2]);
    });
  });

  it('should set thumbnail size', () => {
    const host = document.createElement('div');
    const controller = new GalleryController(host);

    controller.setThumbnailSize(150);
    expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
      '150px',
    );

    controller.setThumbnailSize();
    expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
      `${THUMBNAIL_WIDTH_DEFAULT}px`,
    );
  });

  describe('getColumnWidth', () => {
    it('should return default width if no config', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      expect(controller.getColumnWidth()).toBe(THUMBNAIL_WIDTH_DEFAULT);
    });

    it('should return size if details are hidden', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      expect(
        controller.getColumnWidth(
          createThumbnailConfig({ size: 123, show_details: false }),
        ),
      ).toBe(123);
    });

    it('should return gallery width if details are shown and items are not all folders', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const view = mock<View>();
      const item = new ViewMedia(ViewMediaType.Clip);

      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([item]);

      controller.setItemsFromView(view);
      expect(
        controller.getColumnWidth(createThumbnailConfig({ show_details: true })),
      ).toBe(300);
    });

    it('should return folder width if details are shown and items are all folders', () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const view = mock<View>();
      const item = new ViewFolder(mock<FolderConfig>(), []);

      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([item]);

      controller.setItemsFromView(view);
      expect(
        controller.getColumnWidth(createThumbnailConfig({ show_details: true })),
      ).toBe(200);
    });
  });

  it('should get column count round method', () => {
    const host = document.createElement('div');
    const controller = new GalleryController(host);

    expect(
      controller.getColumnCountRoundMethod(
        createThumbnailConfig({ show_details: true }),
      ),
    ).toBe('floor');
    expect(
      controller.getColumnCountRoundMethod(
        createThumbnailConfig({ show_details: false }),
      ),
    ).toBe('ceil');
    expect(controller.getColumnCountRoundMethod()).toBe('ceil');
  });

  describe('extend', () => {
    it('should handle missing view or query', async () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const runner = mock<UnifiedQueryRunner>();
      const manager = mock<ViewManagerInterface>();
      const epoch = mock<ViewManagerEpoch>({
        manager: manager,
      });

      manager.getView.mockReturnValue(null);
      await controller.extend(runner, epoch, 'earlier');
      expect(runner.extend).not.toHaveBeenCalled();

      const view = mock<View>();
      view.query = null;
      manager.getView.mockReturnValue(view);
      await controller.extend(runner, epoch, 'earlier');
      expect(runner.extend).not.toHaveBeenCalled();
    });

    it('should handle missing results', async () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const runner = mock<UnifiedQueryRunner>();
      const manager = mock<ViewManagerInterface>();
      const epoch = mock<ViewManagerEpoch>({
        manager: manager,
      });
      const view = mock<View>();

      view.query = mock<UnifiedQuery>();
      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue(null);
      manager.getView.mockReturnValue(view);

      await controller.extend(runner, epoch, 'earlier');
      expect(runner.extend).not.toHaveBeenCalled();
    });

    it('should extend and update view', async () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const runner = mock<UnifiedQueryRunner>();
      const manager = mock<ViewManagerInterface>();
      const epoch = mock<ViewManagerEpoch>({
        manager: manager,
      });
      const view = mock<View>();
      const query = mock<UnifiedQuery>();
      const selectedResult = mock<ViewItem>();
      const results = [selectedResult];

      view.query = query;
      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue(results);
      vi.mocked(view.queryResults.getSelectedResult).mockReturnValue(selectedResult);
      manager.getView.mockReturnValue(view);

      const extendedQuery = mock<UnifiedQuery>();
      const extendedResults = [selectedResult, new ViewMedia(ViewMediaType.Clip)];
      runner.extend.mockResolvedValue({
        query: extendedQuery,
        results: extendedResults,
      });

      await controller.extend(runner, epoch, 'earlier');

      expect(runner.extend).toHaveBeenCalledWith(query, results, 'earlier', {
        useCache: true,
      });
      expect(manager.setViewByParameters).toHaveBeenCalled();

      const setViewCalls = vi.mocked(manager.setViewByParameters).mock.calls;
      const setViewParams = setViewCalls[0][0];
      assert(setViewParams && setViewParams.params);

      const newQueryResults = setViewParams.params.queryResults;
      assert(newQueryResults);
      expect(newQueryResults.getResults()).toEqual(extendedResults);

      expect(newQueryResults.getSelectedResult()).toBe(selectedResult);
    });

    it('should handle extend failure', async () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const runner = mock<UnifiedQueryRunner>();
      const manager = mock<ViewManagerInterface>();
      const epoch = mock<ViewManagerEpoch>({
        manager: manager,
      });
      const view = mock<View>();

      view.query = mock<UnifiedQuery>();
      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([
        new ViewMedia(ViewMediaType.Clip),
      ]);
      manager.getView.mockReturnValue(view);

      const error = new Error('test error');
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      runner.extend.mockRejectedValue(error);

      await controller.extend(runner, epoch, 'earlier');

      expect(spy).toHaveBeenCalledWith(error.message);
      spy.mockRestore();
      expect(manager.setViewByParameters).not.toHaveBeenCalled();
    });

    it('should not update view if extend returns null', async () => {
      const host = document.createElement('div');
      const controller = new GalleryController(host);
      const runner = mock<UnifiedQueryRunner>();
      const manager = mock<ViewManagerInterface>();
      const epoch = mock<ViewManagerEpoch>({
        manager: manager,
      });
      const view = mock<View>();

      view.query = mock<UnifiedQuery>();
      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([
        new ViewMedia(ViewMediaType.Clip),
      ]);
      manager.getView.mockReturnValue(view);

      runner.extend.mockResolvedValue(null);

      await controller.extend(runner, epoch, 'earlier');

      expect(manager.setViewByParameters).not.toHaveBeenCalled();
    });
  });
});
