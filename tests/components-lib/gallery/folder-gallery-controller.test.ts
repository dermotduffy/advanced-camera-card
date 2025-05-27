import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ViewManagerInterface } from '../../../src/card-controller/view/types';
import {
  FOLDER_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN,
  FolderGalleryController,
} from '../../../src/components-lib/gallery/folder-gallery-controller';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../../src/config/schema/common/controls/thumbnails';
import { ViewFolder } from '../../../src/view/item';
import { FolderViewQuery } from '../../../src/view/query';
import { QueryResults } from '../../../src/view/query-results';
import { createFolder, createView, TestViewMedia } from '../../test-utils';

// @vitest-environment jsdom
describe('FolderGalleryController', () => {
  describe('should set thumbnail size', () => {
    it('should set thumbnail size explicitly', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      controller.setThumbnailSize(100);

      expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
        '100px',
      );
    });

    it('should set thumbnail size implicitly', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      controller.setThumbnailSize();

      expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
        `${THUMBNAIL_WIDTH_DEFAULT}px`,
      );
    });
  });

  describe('should get column width', () => {
    it('should get default column width', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      expect(controller.getColumnWidth()).toBe(THUMBNAIL_WIDTH_DEFAULT);
    });

    it('should get column width with defailts', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      expect(
        controller.getColumnWidth({
          size: 100,
          show_details: true,
          show_favorite_control: true,
          show_timeline_control: true,
          show_download_control: true,
        }),
      ).toBe(FOLDER_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN);
    });

    it('should get column width with explicit size', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      expect(
        controller.getColumnWidth({
          size: 142,
          show_details: false,
          show_favorite_control: true,
          show_timeline_control: true,
          show_download_control: true,
        }),
      ).toBe(142);
    });
  });

  describe('should get column count round method', () => {
    it('should get default column count round method', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      expect(controller.getColumnCountRoundMethod()).toBe('ceil');
    });

    it('should get column count round method when details being shown', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      expect(
        controller.getColumnCountRoundMethod({
          size: 100,
          show_details: true,
          show_favorite_control: true,
          show_timeline_control: true,
          show_download_control: true,
        }),
      ).toBe('floor');
    });
  });

  describe('should handle item clicks', () => {
    it('should ignore calls without view', () => {
      const host = document.createElement('div');
      const controller = new FolderGalleryController(host);

      const viewManager = mock<ViewManagerInterface>();

      const item = new TestViewMedia();
      controller.itemClickHandler(viewManager, item, new Event('click'));

      expect(viewManager.setViewByParameters).not.toHaveBeenCalled();
      expect(viewManager.setViewByParametersWithExistingQuery).not.toHaveBeenCalled();
    });

    it('should handle media item click', () => {
      const host = document.createElement('div');
      const item_1 = new TestViewMedia();
      const item_2 = new TestViewMedia();

      const controller = new FolderGalleryController(host);
      const event = new Event('click');

      const view = createView({
        queryResults: new QueryResults({ results: [item_1, item_2], selectedIndex: 0 }),
      });

      const viewManager = mock<ViewManagerInterface>();
      viewManager.getView.mockReturnValue(view);

      controller.itemClickHandler(viewManager, item_2, event);

      expect(viewManager.setViewByParameters).toHaveBeenCalledWith({
        params: {
          view: 'media',
          queryResults: expect.any(QueryResults),
        },
      });

      const newQueryResults =
        viewManager.setViewByParameters.mock.calls[0][0]?.params?.queryResults;
      expect(newQueryResults).toBeInstanceOf(QueryResults);
      expect(newQueryResults?.getSelectedResult()).toBe(item_2);
    });

    describe('should handle folder click', () => {
      it('should handle normal folder click', () => {
        const folder = createFolder();
        const folderItem = new ViewFolder(folder, {
          id: 'parent',
        });

        const controller = new FolderGalleryController(document.createElement('div'));
        const event = new Event('click');

        const view = createView({
          queryResults: new QueryResults({
            results: [new TestViewMedia(), folderItem],
            selectedIndex: 0,
          }),
          query: new FolderViewQuery({
            folder,
            path: [{ ha: { id: 'grandparent' } }],
          }),
        });

        const viewManager = mock<ViewManagerInterface>();
        viewManager.getView.mockReturnValue(view);

        controller.itemClickHandler(viewManager, folderItem, event);

        expect(viewManager.setViewByParametersWithExistingQuery).toHaveBeenCalledWith({
          params: {
            query: expect.any(FolderViewQuery),
          },
        });

        const newQuery =
          viewManager.setViewByParametersWithExistingQuery.mock.calls[0][0]?.params
            ?.query;
        expect(newQuery).toBeInstanceOf(FolderViewQuery);
        expect(newQuery?.getQuery()).toEqual({
          folder,
          path: [{ ha: { id: 'grandparent' } }, { folder: folderItem }],
        });
      });

      it('should handle folder click without query', () => {
        const controller = new FolderGalleryController(document.createElement('div'));

        const view = createView({
          query: null,
        });
        const viewManager = mock<ViewManagerInterface>();
        viewManager.getView.mockReturnValue(view);

        controller.itemClickHandler(
          viewManager,
          new ViewFolder(createFolder(), {
            id: 'parent',
          }),
          new Event('click'),
        );

        expect(viewManager.setViewByParametersWithExistingQuery).not.toBeCalled();
        expect(viewManager.setViewByParameters).not.toBeCalled();
      });

      it('should handle folder click without path', () => {
        const controller = new FolderGalleryController(document.createElement('div'));
        const folder = createFolder();

        const view = createView({
          query: new FolderViewQuery({
            folder,
            path: [{ ha: { id: 'id' } }],
          }),
        });
        const viewManager = mock<ViewManagerInterface>();
        viewManager.getView.mockReturnValue(view);

        controller.itemClickHandler(
          viewManager,
          new ViewFolder(folder),
          new Event('click'),
        );

        expect(viewManager.setViewByParametersWithExistingQuery).not.toBeCalled();
        expect(viewManager.setViewByParameters).not.toBeCalled();
      });
    });
  });
});
