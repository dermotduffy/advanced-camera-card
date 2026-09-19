import {
  afterAll,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mock } from 'vitest-mock-extended';

import type {
  ViewManagerEpoch,
  ViewManagerInterface,
} from '../../../src/card-controller/view/types';
import { GalleryController } from '../../../src/components-lib/gallery/controller';
import {
  THUMBNAIL_SIZE_DEFAULT,
  THUMBNAIL_SIZE_MIN,
  type ThumbnailsControlBaseConfig,
} from '../../../src/config/schema/common/controls/thumbnails';
import type { FolderConfig } from '../../../src/config/schema/folders';
import {
  ViewFolder,
  ViewMedia,
  ViewMediaType,
  type ViewItem,
} from '../../../src/view/item';
import type { QueryResults } from '../../../src/view/query-results';
import type { UnifiedQuery } from '../../../src/view/unified-query';
import type { UnifiedQueryRunner } from '../../../src/view/unified-query-runner';
import type { View } from '../../../src/view/view';
import {
  callResizeHandler,
  createLitElement,
  ResizeObserverMock,
  stubMatchMedia,
} from '../../test-utils';

// @vitest-environment jsdom
const createThumbnailConfig = (
  config?: Partial<ThumbnailsControlBaseConfig>,
): ThumbnailsControlBaseConfig => ({
  size: THUMBNAIL_SIZE_DEFAULT,
  style: 'panel',
  show_favorite_control: true,
  show_timeline_control: true,
  show_download_control: true,
  show_review_control: true,
  show_info_control: true,
  ...config,
});

describe('GalleryController', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stubMatchMedia().mockReturnValue({ matches: true });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should construct', () => {
    const host = createLitElement();
    const controller = new GalleryController(host);
    expect(controller).toBeTruthy();
    expect(controller.getItems()).toBeNull();
  });

  describe('setItemsFromView', () => {
    it('should set items from view', () => {
      const host = createLitElement();
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
      const host = createLitElement();
      const controller = new GalleryController(host);

      controller.setItemsFromView(null);
      expect(controller.getItems()).toBeNull();

      const view = mock<View>();
      view.queryResults = null;
      controller.setItemsFromView(view);
      expect(controller.getItems()).toBeNull();
    });

    it('should not update items if results are the same', () => {
      const host = createLitElement();
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
      const host = createLitElement();
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
    const host = createLitElement();
    const controller = new GalleryController(host);

    controller.setThumbnailConfig(createThumbnailConfig({ size: 150 }));
    expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
      '150px',
    );

    controller.setThumbnailConfig();
    expect(host.style.getPropertyValue('--advanced-camera-card-thumbnail-size')).toBe(
      `${THUMBNAIL_SIZE_DEFAULT}px`,
    );
  });

  describe('getColumnWidth', () => {
    it('should return default width if no config', () => {
      const controller = new GalleryController(createLitElement());
      expect(controller.getColumnWidth()).toBe(THUMBNAIL_SIZE_DEFAULT);
    });

    it('should return size if details are hidden', () => {
      const controller = new GalleryController(createLitElement());

      controller.setThumbnailConfig(createThumbnailConfig({ size: 123, style: 'none' }));

      expect(controller.getColumnWidth()).toBe(123);
    });

    it('should return gallery width if details are shown and items are not all folders', () => {
      const controller = new GalleryController(createLitElement());
      const view = mock<View>();

      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([
        new ViewMedia(ViewMediaType.Clip),
      ]);
      controller.setItemsFromView(view);
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'panel' }));

      expect(controller.getColumnWidth()).toBe(250);
    });

    it('should return folder width if details are shown and items are all folders', () => {
      const controller = new GalleryController(createLitElement());
      const view = mock<View>();

      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([
        new ViewFolder(mock<FolderConfig>(), []),
      ]);
      controller.setItemsFromView(view);
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'panel' }));

      expect(controller.getColumnWidth()).toBe(270);
    });

    it('should not shrink the column below the minimum', () => {
      const controller = new GalleryController(createLitElement());

      controller.setThumbnailConfig(
        createThumbnailConfig({ size: THUMBNAIL_SIZE_MIN, style: 'panel' }),
      );

      expect(controller.getColumnWidth()).toBe(250);
    });

    it('should grow the column with the thumbnail size', () => {
      const controller = new GalleryController(createLitElement());

      controller.setThumbnailConfig(
        createThumbnailConfig({ size: 300, style: 'panel' }),
      );

      expect(controller.getColumnWidth()).toBe(450);
    });

    it('should grow the folder column with the thumbnail size', () => {
      const controller = new GalleryController(createLitElement());
      const view = mock<View>();

      view.queryResults = mock<QueryResults>();
      vi.mocked(view.queryResults.getResults).mockReturnValue([
        new ViewFolder(mock<FolderConfig>(), []),
      ]);
      controller.setItemsFromView(view);
      controller.setThumbnailConfig(
        createThumbnailConfig({ size: 300, style: 'panel' }),
      );

      expect(controller.getColumnWidth()).toBe(470);
    });
  });

  describe('getResolvedThumbnailStyle', () => {
    it('should have no details without config', () => {
      const controller = new GalleryController(createLitElement());
      expect(controller.getResolvedThumbnailStyle()).toBeNull();
    });

    it('should return the configured thumbnail style', () => {
      const controller = new GalleryController(createLitElement());

      controller.setThumbnailConfig(createThumbnailConfig({ style: 'overlay' }));

      expect(controller.getResolvedThumbnailStyle()).toBe('overlay');
    });

    it('should resolve automatically from the size', () => {
      const controller = new GalleryController(createLitElement());

      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 100 }));
      expect(controller.getResolvedThumbnailStyle()).toBe('overlay');

      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 200 }));
      expect(controller.getResolvedThumbnailStyle()).toBe('hover');
    });

    it('should resolve automatically from the gallery width', () => {
      const host = createLitElement();
      const controller = new GalleryController(host);
      controller.hostConnected();
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 200 }));

      Object.defineProperty(host, 'clientWidth', { value: 240, configurable: true });
      callResizeHandler([{ target: host, width: 240, height: 100 }]);

      expect(controller.getResolvedThumbnailStyle()).toBe('overlay');
    });
  });

  describe('resize', () => {
    it('should request an update when the thumbnail style changes', () => {
      const host = createLitElement();
      const controller = new GalleryController(host);
      controller.hostConnected();
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 200 }));

      Object.defineProperty(host, 'clientWidth', { value: 240, configurable: true });
      callResizeHandler([{ target: host, width: 240, height: 100 }]);

      expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not request an update when the thumbnail style is unchanged', () => {
      const host = createLitElement();
      const controller = new GalleryController(host);
      controller.hostConnected();
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 200 }));

      Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true });
      callResizeHandler([{ target: host, width: 800, height: 100 }]);
      Object.defineProperty(host, 'clientWidth', { value: 900, configurable: true });
      callResizeHandler([{ target: host, width: 900, height: 100 }]);

      expect(host.requestUpdate).not.toHaveBeenCalled();
    });

    it('should not resolve again when the width is unchanged', () => {
      const host = createLitElement();
      const controller = new GalleryController(host);
      controller.hostConnected();
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 200 }));

      Object.defineProperty(host, 'clientWidth', { value: 240, configurable: true });
      callResizeHandler([{ target: host, width: 240, height: 100 }]);
      callResizeHandler([{ target: host, width: 240, height: 100 }]);

      expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    });

    it('should forget the width when disconnected', () => {
      const host = createLitElement();
      const controller = new GalleryController(host);
      controller.hostConnected();
      controller.setThumbnailConfig(createThumbnailConfig({ style: 'auto', size: 200 }));

      Object.defineProperty(host, 'clientWidth', { value: 240, configurable: true });
      callResizeHandler([{ target: host, width: 240, height: 100 }]);
      controller.hostDisconnected();

      expect(controller.getResolvedThumbnailStyle()).toBe('hover');
    });
  });

  it('should get column count round method', () => {
    const controller = new GalleryController(createLitElement());

    controller.setThumbnailConfig(createThumbnailConfig({ style: 'panel' }));
    expect(controller.getColumnCountRoundMethod()).toBe('floor');

    controller.setThumbnailConfig(createThumbnailConfig({ style: 'none' }));
    expect(controller.getColumnCountRoundMethod()).toBe('ceil');

    controller.setThumbnailConfig();
    expect(controller.getColumnCountRoundMethod()).toBe('ceil');
  });

  describe('extend', () => {
    it('should handle missing view or query', async () => {
      const host = createLitElement();
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
      const host = createLitElement();
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
      const host = createLitElement();
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
      const host = createLitElement();
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
      const spy = vi.spyOn(console, 'warn');
      runner.extend.mockRejectedValue(error);

      await controller.extend(runner, epoch, 'earlier');

      expect(spy).toHaveBeenCalledWith(error.message);
      spy.mockRestore();
      expect(manager.setViewByParameters).not.toHaveBeenCalled();
    });

    it('should not update view if extend returns null', async () => {
      const host = createLitElement();
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
