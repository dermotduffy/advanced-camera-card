import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ExtendedMediaQueryResult } from '../../../src/camera-manager/manager';
import {
  EventQuery,
  QueryType,
  RecordingQuery,
} from '../../../src/camera-manager/types';
import { ViewManagerEpoch } from '../../../src/card-controller/view/types';
import { ViewManager } from '../../../src/card-controller/view/view-manager';
import {
  MEDIA_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN,
  MediaGalleryController,
} from '../../../src/components-lib/gallery/media-gallery-controller';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../../src/config/schema/common/controls/thumbnails';
import {
  EventMediaQuery,
  FolderViewQuery,
  RecordingMediaQuery,
} from '../../../src/view/query';
import { QueryResults } from '../../../src/view/query-results';
import {
  createCameraManager,
  createLitElement,
  createView,
  TestViewMedia,
} from '../../test-utils';

// @vitest-environment jsdom
describe('MediaGalleryController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMedia', () => {
    it('should return null initially', () => {
      expect(new MediaGalleryController(createLitElement()).getMedia()).toBeNull();
    });
  });

  describe('setMediaFromView', () => {
    it('should set media from view if media is null', () => {
      const controller = new MediaGalleryController(createLitElement());
      controller.setMediaFromView(null);
      expect(controller.getMedia()).toBeNull();
    });

    it('should set media from view if results are null', () => {
      const controller = new MediaGalleryController(createLitElement());
      controller.setMediaFromView(createView({ queryResults: new QueryResults() }));
      expect(controller.getMedia()).toEqual([]);
    });

    it('should update media when query results first set', () => {
      const media_1 = new TestViewMedia({ id: 'one' });
      const media_2 = new TestViewMedia({ id: 'two' });
      const newView = createView({
        queryResults: new QueryResults({ results: [media_1, media_2] }),
      });
      const controller = new MediaGalleryController(createLitElement());
      controller.setMediaFromView(newView);
      expect(controller.getMedia()).toEqual([media_2, media_1]);
    });

    it('should update media when query results change', () => {
      const media_1 = new TestViewMedia({ id: 'one' });
      const media_2 = new TestViewMedia({ id: 'two' });
      const media_3 = new TestViewMedia({ id: 'three' });

      const oldView = createView({
        queryResults: new QueryResults({ results: [media_1, media_2] }),
      });
      const newView = createView({
        queryResults: new QueryResults({ results: [media_2, media_3] }),
      });

      const controller = new MediaGalleryController(createLitElement());
      controller.setMediaFromView(newView, oldView);
      expect(controller.getMedia()).toEqual([media_3, media_2]);
    });

    it('should not update media if query results are the same', () => {
      const media_1 = new TestViewMedia({ id: 'one' });
      const media_2 = new TestViewMedia({ id: 'two' });
      const results = [media_1, media_2];
      const oldView = createView({
        queryResults: new QueryResults({ results }),
      });
      const newView = createView({
        queryResults: new QueryResults({ results }),
      });

      const controller = new MediaGalleryController(createLitElement());
      controller.setMediaFromView(oldView);
      const media = controller.getMedia();

      controller.setMediaFromView(newView, oldView);

      expect(controller.getMedia()).toBe(media);
    });
  });

  describe('should set thumbnail size', () => {
    it('should set thumbnail size explicitly', () => {
      const host = document.createElement('div');
      const controller = new MediaGalleryController(host);

      controller.setThumbnailSize(100);

      expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
        '100px',
      );
    });

    it('should set thumbnail size implicitly', () => {
      const host = document.createElement('div');
      const controller = new MediaGalleryController(host);

      controller.setThumbnailSize();

      expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
        `${THUMBNAIL_WIDTH_DEFAULT}px`,
      );
    });
  });

  describe('should get column width', () => {
    it('should get default column width', () => {
      const host = document.createElement('div');
      const controller = new MediaGalleryController(host);

      expect(controller.getColumnWidth()).toBe(THUMBNAIL_WIDTH_DEFAULT);
    });

    it('should get column width with defailts', () => {
      const host = document.createElement('div');
      const controller = new MediaGalleryController(host);

      expect(
        controller.getColumnWidth({
          size: 100,
          show_details: true,
          show_favorite_control: true,
          show_timeline_control: true,
          show_download_control: true,
        }),
      ).toBe(MEDIA_GALLERY_THUMBNAIL_DETAILS_WIDTH_MIN);
    });

    it('should get column width with explicit size', () => {
      const host = document.createElement('div');
      const controller = new MediaGalleryController(host);

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
      const controller = new MediaGalleryController(host);

      expect(controller.getColumnCountRoundMethod()).toBe('ceil');
    });

    it('should get column count round method when details being shown', () => {
      const host = document.createElement('div');
      const controller = new MediaGalleryController(host);

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

  describe('extendMediaGallery', () => {
    it('should do nothing if no view is available', async () => {
      const controller = new MediaGalleryController(createLitElement());
      const cameraManager = createCameraManager();
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(null);

      await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
      expect(cameraManager.extendMediaQueries).not.toHaveBeenCalled();
    });

    it('should do nothing if no queries are available', async () => {
      const controller = new MediaGalleryController(createLitElement());
      const cameraManager = createCameraManager();
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(
        createView({
          query: new EventMediaQuery(),
          queryResults: new QueryResults({ results: [new TestViewMedia()] }),
        }),
      );

      await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
      expect(cameraManager.extendMediaQueries).not.toHaveBeenCalled();
    });

    it('should do nothing if no query results are available', async () => {
      const controller = new MediaGalleryController(createLitElement());
      const cameraManager = createCameraManager();
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(createView());

      await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
      expect(cameraManager.extendMediaQueries).not.toHaveBeenCalled();
    });

    it('should do nothing if non-media query is present', async () => {
      const controller = new MediaGalleryController(createLitElement());
      const cameraManager = createCameraManager();
      const viewManagerEpoch = mock<ViewManagerEpoch>();
      viewManagerEpoch.manager.getView = vi
        .fn()
        .mockReturnValue(createView({ query: new FolderViewQuery() }));

      await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
      expect(cameraManager.extendMediaQueries).not.toHaveBeenCalled();
    });

    it('should successfully extend event media queries', async () => {
      const controller = new MediaGalleryController(createLitElement());
      const cameraManager = createCameraManager();
      const viewManagerEpoch = mock<ViewManagerEpoch>({ manager: mock<ViewManager>() });

      const existingRawQueries: EventQuery[] = [
        { type: QueryType.Event, cameraIDs: new Set(['camera.office']) },
      ];
      const existingMedia = [new TestViewMedia()];
      const baseView = createView({
        query: new EventMediaQuery(existingRawQueries),
        queryResults: new QueryResults({ results: existingMedia }),
      });
      viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(baseView);

      const newQueries: EventQuery[] = [
        { type: QueryType.Event, cameraIDs: new Set(['camera.office']) },
      ];
      const newResults = [new TestViewMedia()];

      const extension: ExtendedMediaQueryResult<EventQuery> = {
        queries: newQueries,
        results: newResults,
      };
      vi.mocked(cameraManager.extendMediaQueries).mockResolvedValue(extension);

      await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
      expect(cameraManager.extendMediaQueries).toBeCalledWith(
        existingRawQueries,
        existingMedia,
        'earlier',
        { useCache: true },
      );
      expect(viewManagerEpoch.manager.setViewByParameters).toBeCalledWith({
        baseView,
        params: {
          query: expect.any(EventMediaQuery),
          queryResults: expect.any(QueryResults),
        },
      });

      const callArguments = vi.mocked(viewManagerEpoch.manager.setViewByParameters).mock
        .lastCall?.[0];

      expect(callArguments?.params?.query?.getQuery()).toEqual(newQueries);
      expect(callArguments?.params?.queryResults?.getResults()).toEqual(newResults);
    });
  });

  it('should successfully extend recording media queries', async () => {
    const controller = new MediaGalleryController(createLitElement());
    const cameraManager = createCameraManager();
    const viewManagerEpoch = mock<ViewManagerEpoch>({ manager: mock<ViewManager>() });

    const existingRawQueries: RecordingQuery[] = [
      { type: QueryType.Recording, cameraIDs: new Set(['camera.office']) },
    ];
    const existingMedia = [new TestViewMedia()];
    const baseView = createView({
      query: new RecordingMediaQuery(existingRawQueries),
      queryResults: new QueryResults({ results: existingMedia }),
    });
    viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(baseView);

    const newQueries: RecordingQuery[] = [
      { type: QueryType.Recording, cameraIDs: new Set(['camera.office']) },
    ];
    const newResults = [new TestViewMedia()];

    const extension: ExtendedMediaQueryResult<RecordingQuery> = {
      queries: newQueries,
      results: newResults,
    };
    vi.mocked(cameraManager.extendMediaQueries).mockResolvedValue(extension);

    await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
    expect(cameraManager.extendMediaQueries).toBeCalledWith(
      existingRawQueries,
      existingMedia,
      'earlier',
      { useCache: true },
    );
    expect(viewManagerEpoch.manager.setViewByParameters).toBeCalledWith({
      baseView,
      params: {
        query: expect.any(RecordingMediaQuery),
        queryResults: expect.any(QueryResults),
      },
    });

    const callArguments = vi.mocked(viewManagerEpoch.manager.setViewByParameters).mock
      .lastCall?.[0];

    expect(callArguments?.params?.query?.getQuery()).toEqual(newQueries);
    expect(callArguments?.params?.queryResults?.getResults()).toEqual(newResults);
  });

  it('should handle errors gracefully', async () => {
    const controller = new MediaGalleryController(createLitElement());
    const cameraManager = createCameraManager();
    const viewManagerEpoch = mock<ViewManagerEpoch>({ manager: mock<ViewManager>() });

    viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(
      createView({
        query: new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera.office']) },
        ]),
        queryResults: new QueryResults({ results: [new TestViewMedia()] }),
      }),
    );

    vi.mocked(cameraManager.extendMediaQueries).mockRejectedValue(
      new Error('Test error'),
    );

    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);
    await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');

    expect(viewManagerEpoch.manager.setViewByParameters).not.toHaveBeenCalled();

    expect(consoleSpy).toBeCalledWith('Test error');
  });

  it('should handle null extension gracefully', async () => {
    const controller = new MediaGalleryController(createLitElement());
    const cameraManager = createCameraManager();
    const viewManagerEpoch = mock<ViewManagerEpoch>({ manager: mock<ViewManager>() });

    viewManagerEpoch.manager.getView = vi.fn().mockReturnValue(
      createView({
        query: new EventMediaQuery([
          { type: QueryType.Event, cameraIDs: new Set(['camera.office']) },
        ]),
        queryResults: new QueryResults({ results: [new TestViewMedia()] }),
      }),
    );

    vi.mocked(cameraManager.extendMediaQueries).mockResolvedValue(null);

    await controller.extendMediaGallery(cameraManager, viewManagerEpoch, 'earlier');
    expect(viewManagerEpoch.manager.setViewByParameters).not.toHaveBeenCalled();
  });

  describe('should handle item click', () => {
    it('should do nothing without a view', () => {
      const controller = new MediaGalleryController(createLitElement());
      const viewManager = mock<ViewManager>();

      controller.itemClickHandler(viewManager, 0, new Event('click'));

      expect(viewManager.setViewByParameters).not.toHaveBeenCalled();
    });

    it('should change view to selected item', () => {
      const media = [
        new TestViewMedia({ id: 'zero' }),
        new TestViewMedia({ id: 'one' }),
      ];
      const view = createView({
        queryResults: new QueryResults({ results: media, selectedIndex: 0 }),
      });

      const controller = new MediaGalleryController(createLitElement());
      controller.setMediaFromView(view);

      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(view);

      controller.itemClickHandler(
        viewManager,
        // As the media in the gallery is reversed, passing in 0 as a
        // reversedIndex argument is requesting the selection of the media item
        // with index 1 (from an array of 2 media items).
        0,
        new Event('click'),
      );

      expect(viewManager.setViewByParameters).toBeCalledWith({
        params: {
          view: 'media',
          queryResults: expect.any(QueryResults),
        },
      });

      const newQueryResults = vi.mocked(viewManager.setViewByParameters).mock
        .lastCall?.[0]?.params?.queryResults;
      expect(newQueryResults?.getSelectedResult()).toEqual(media[1]);
    });
  });
});
