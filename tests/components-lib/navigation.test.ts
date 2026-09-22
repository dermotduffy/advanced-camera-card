import { assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManager } from '../../src/camera-manager/manager';
import { QueryType, type EventQuery } from '../../src/camera-manager/types';
import type { FoldersManager } from '../../src/card-controller/folders/manager';
import type {
  FolderPathLevel,
  FolderQuery,
} from '../../src/card-controller/folders/types';
import type {
  ViewManagerEpoch,
  ViewModifier,
} from '../../src/card-controller/view/types';
import {
  getUpFolderItem,
  navigateDownIntoFolder,
  navigateToMedia,
  navigateUp,
  type FolderNavigationParamaters,
  type MediaNavigationParamaters,
} from '../../src/components-lib/navigation';
import { QuerySource } from '../../src/query-source';
import { ViewFolder, ViewMedia } from '../../src/view/item';
import { UnifiedQuery } from '../../src/view/unified-query';
import { UnifiedQueryBuilder } from '../../src/view/unified-query-builder';
import { createCardAPI, createFolder } from '../test-utils';
import { createView, createViewWithMedia } from '../view/test-utils';

const createFolderQuery = (
  folder: ReturnType<typeof createFolder>,
  path: FolderPathLevel[] = [{}],
): UnifiedQuery => {
  const query = new UnifiedQuery();
  query.addNode({
    source: QuerySource.Folder,
    folder,
    path,
  });
  return query;
};

const createCameraQuery = (): UnifiedQuery => {
  const query = new UnifiedQuery();
  const eventNode: EventQuery = {
    source: QuerySource.Camera,
    type: QueryType.Event,
    cameraIDs: new Set(['camera1']),
    hasClip: true,
  };
  query.addNode(eventNode);
  return query;
};

const createHarness = (options?: {
  query?: UnifiedQuery;
  upQuery?: FolderQuery | null;
  downQuery?: FolderQuery | null;
}) => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(
    createView({ query: options?.query }),
  );
  vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery).mockResolvedValue(
    undefined,
  );

  const foldersManager = mock<FoldersManager>();
  foldersManager.getUpQuery.mockReturnValue(options?.upQuery ?? null);
  foldersManager.getDownQuery.mockReturnValue(options?.downQuery ?? null);

  const navigationParameters: FolderNavigationParamaters = {
    viewManagerEpoch: { manager: api.getViewManager() },
    foldersManager,
    builder: new UnifiedQueryBuilder(mock<CameraManager>(), foldersManager),
  };

  return { api, foldersManager, navigationParameters };
};

const getNavigatedNode = (api: ReturnType<typeof createCardAPI>): unknown => {
  const query = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery).mock
    .calls[0][0]?.params?.query;
  const nodes = query?.getNodes();
  expect(nodes).toHaveLength(1);
  return nodes?.[0];
};

describe('navigateUp', () => {
  it('should do nothing with null options', () => {
    navigateUp(null);

    // No error thrown
  });

  it('should ignore a non-folder query', () => {
    const { api, foldersManager, navigationParameters } = createHarness({
      query: createCameraQuery(),
    });

    navigateUp(navigationParameters);

    expect(foldersManager.getUpQuery).not.toHaveBeenCalled();
    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
  });

  it('should ignore a folder without a parent to go up to', () => {
    const folder = createFolder();
    const { api, navigationParameters } = createHarness({
      query: createFolderQuery(folder),
      upQuery: null,
    });

    navigateUp(navigationParameters);

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
  });

  it('should go up in the folder hierarchy', () => {
    const folder = createFolder();
    const query = createFolderQuery(folder, [{}, {}, {}]);
    const upQuery: FolderQuery = {
      source: QuerySource.Folder,
      folder,
      path: [{}, {}],
    };
    const { api, foldersManager, navigationParameters } = createHarness({
      query,
      upQuery,
    });

    navigateUp(navigationParameters);

    expect(foldersManager.getUpQuery).toHaveBeenCalledWith(
      expect.objectContaining({ folder }),
    );
    expect(getNavigatedNode(api)).toMatchObject({
      source: QuerySource.Folder,
      folder,
      path: upQuery.path,
    });
  });

  it('should ignore a failure to change the view', async () => {
    const folder = createFolder();
    const { api, navigationParameters } = createHarness({
      query: createFolderQuery(folder, [{}, {}, {}]),
      upQuery: { source: QuerySource.Folder, folder, path: [{}, {}] },
    });
    vi.mocked(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).mockRejectedValue(new Error('Could not set view'));

    navigateUp(navigationParameters);

    // An unhandled rejection would fail the test.
    await Promise.resolve();
  });
});

describe('navigateDownIntoFolder', () => {
  it('should do nothing with null options', () => {
    const item = new ViewFolder(createFolder(), [{}]);

    navigateDownIntoFolder(item, null);

    // No error thrown
  });

  it('should ignore an item without a path to descend to', () => {
    const folder = createFolder();
    const { api, navigationParameters } = createHarness({
      query: createFolderQuery(folder),
      downQuery: null,
    });

    navigateDownIntoFolder(new ViewFolder(folder, [{}]), navigationParameters);

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
  });

  it('should navigate into a folder', () => {
    const folder = createFolder();
    const item = new ViewFolder(folder, [{}]);
    const downQuery: FolderQuery = {
      source: QuerySource.Folder,
      folder,
      path: [{ folder: item }, {}],
    };
    const { api, foldersManager, navigationParameters } = createHarness({
      query: createFolderQuery(folder),
      downQuery,
    });

    navigateDownIntoFolder(item, navigationParameters);

    expect(foldersManager.getDownQuery).toHaveBeenCalledWith(item);
    expect(getNavigatedNode(api)).toMatchObject({
      source: QuerySource.Folder,
      folder,
      path: downQuery.path,
    });
  });
});

describe('getUpFolderItem', () => {
  it('should return null without options', () => {
    expect(getUpFolderItem(null)).toBeNull();
  });

  it('should return null for a non-folder query', () => {
    const { navigationParameters } = createHarness({ query: createCameraQuery() });

    expect(getUpFolderItem(navigationParameters)).toBeNull();
  });

  it('should return null for a folder without a parent to go up to', () => {
    const { navigationParameters } = createHarness({
      query: createFolderQuery(createFolder()),
      upQuery: null,
    });

    expect(getUpFolderItem(navigationParameters)).toBeNull();
  });

  it('should return null when the view shows more than one folder', () => {
    const folder = createFolder();
    const query = createFolderQuery(folder);
    query.addNode({ source: QuerySource.Folder, folder: createFolder(), path: [{}] });

    const { foldersManager, navigationParameters } = createHarness({
      query,
      upQuery: { source: QuerySource.Folder, folder, path: [{}, {}] },
    });

    expect(getUpFolderItem(navigationParameters)).toBeNull();
    expect(foldersManager.getUpQuery).not.toHaveBeenCalled();
  });

  it('should return an up folder for a navigable folder query', () => {
    const folder = createFolder();
    const upQuery: FolderQuery = {
      source: QuerySource.Folder,
      folder,
      path: [{}, {}],
    };
    const { navigationParameters } = createHarness({
      query: createFolderQuery(folder, [{}, {}, {}]),
      upQuery,
    });

    const folderItem = getUpFolderItem(navigationParameters);

    expect(folderItem).toBeInstanceOf(ViewFolder);
    expect(folderItem?.getIcon()).toBe('mdi:arrow-up-left');
    expect(folderItem?.getPath()).toBe(upQuery.path);
  });
});

describe('navigateToMedia', () => {
  it('should do nothing with null options', () => {
    navigateToMedia(mock<ViewMedia>(), null);
    // No error thrown
  });

  it('should navigate with viewManagerEpoch', () => {
    const api = createCardAPI();
    const view = createViewWithMedia();
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const media = mock<ViewMedia>();
    const options: MediaNavigationParamaters = {
      viewManagerEpoch: epoch,
    };

    navigateToMedia(media, options);

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          view: 'media',
          queryResults: expect.anything(),
        }),
      }),
    );
  });

  it('should select the correct media', () => {
    const api = createCardAPI();
    const view = createViewWithMedia();
    const media = view.queryResults?.getResult(2);

    assert(media instanceof ViewMedia);

    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const options: MediaNavigationParamaters = {
      viewManagerEpoch: {
        manager: api.getViewManager(),
      },
    };

    navigateToMedia(media, options);

    const call = vi.mocked(api.getViewManager().setViewByParameters).mock.calls[0]?.[0];
    expect(call?.params?.queryResults?.getSelectedIndex()).toBe(2);
  });

  it('should set camera', () => {
    const api = createCardAPI();
    const view = createViewWithMedia();
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const media = mock<ViewMedia>();
    vi.mocked(media.getCameraID).mockReturnValue('camera1');

    const options: MediaNavigationParamaters = {
      viewManagerEpoch: {
        manager: api.getViewManager(),
      },
    };

    navigateToMedia(media, options);

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          view: 'media',
          queryResults: expect.anything(),
          camera: 'camera1',
        }),
      }),
    );
  });

  it('should navigate with modifiers', () => {
    const api = createCardAPI();
    const view = createViewWithMedia();
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const media = mock<ViewMedia>();
    const modifier = mock<ViewModifier>();
    const options: MediaNavigationParamaters = {
      viewManagerEpoch: {
        manager: api.getViewManager(),
      },
      modifiers: [modifier],
    };

    navigateToMedia(media, options);

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        modifiers: [modifier],
      }),
    );
  });

  it('should do nothing if queryResults are missing', () => {
    const api = createCardAPI();
    const view = createView();
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const media = mock<ViewMedia>();
    const options: MediaNavigationParamaters = {
      viewManagerEpoch: {
        manager: api.getViewManager(),
      },
    };

    navigateToMedia(media, options);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should do nothing if view is missing', () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    const media = mock<ViewMedia>();
    const options: MediaNavigationParamaters = {
      viewManagerEpoch: {
        manager: api.getViewManager(),
      },
    };

    navigateToMedia(media, options);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });
});
