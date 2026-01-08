import { NonEmptyTuple } from 'type-fest';
import { assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../src/camera-manager/manager';
import { EventQuery, QueryType } from '../../src/camera-manager/types';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { FolderPathComponent } from '../../src/card-controller/folders/types';
import { ViewManagerEpoch, ViewModifier } from '../../src/card-controller/view/types';
import {
  FolderNavigationParamaters,
  MediaNavigationParamaters,
  getUpFolderItem,
  navigateToFolder,
  navigateToMedia,
  navigateUp,
} from '../../src/components-lib/navigation';
import { QuerySource } from '../../src/query-source';
import { ViewFolder, ViewMedia } from '../../src/view/item';
import { UnifiedQuery } from '../../src/view/unified-query';
import { UnifiedQueryBuilder } from '../../src/view/unified-query-builder';
import {
  createCardAPI,
  createFolder,
  createView,
  createViewWithMedia,
} from '../test-utils';

const createFolderQuery = (
  folder: ReturnType<typeof createFolder>,
  path: NonEmptyTuple<FolderPathComponent> = [{}],
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

describe('navigateUp', () => {
  it('should do nothing with null options', () => {
    navigateUp(null);

    // No error thrown
  });

  it('should ignore non-folder query', () => {
    const api = createCardAPI();
    const view = createView({
      query: createCameraQuery(),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const builder = new UnifiedQueryBuilder(
      mock<CameraManager>(),
      mock<FoldersManager>(),
    );
    const options: FolderNavigationParamaters = {
      builder,
      viewManagerEpoch: epoch,
    };

    navigateUp(options);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should ignore folder query without parent to go up to', () => {
    const api = createCardAPI();
    const folder = createFolder();
    const view = createView({
      query: createFolderQuery(folder, [{ ha: { id: 'root' } }]),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const builder = new UnifiedQueryBuilder(
      mock<CameraManager>(),
      mock<FoldersManager>(),
    );
    const options: FolderNavigationParamaters = {
      builder,
      viewManagerEpoch: epoch,
    };

    navigateUp(options);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should go up in the folder hierarchy', () => {
    const api = createCardAPI();
    const folder = createFolder();
    const view = createView({
      query: createFolderQuery(folder, [
        { ha: { id: 'one' } },
        { ha: { id: 'two' } },
        { ha: { id: 'three' } },
      ]),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const builder = new UnifiedQueryBuilder(
      mock<CameraManager>(),
      mock<FoldersManager>(),
    );
    const options: FolderNavigationParamaters = {
      builder,
      viewManagerEpoch: epoch,
    };

    navigateUp(options);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).toBeCalledWith({
      params: {
        query: expect.any(UnifiedQuery),
      },
    });

    const query = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0][0]?.params?.query as UnifiedQuery;
    const nodes = query.getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      source: QuerySource.Folder,
      folder,
      path: [{ ha: { id: 'one' } }, { ha: { id: 'two' } }],
    });
  });

  it('should go up in the folder hierarchy with limit', () => {
    const api = createCardAPI();
    const folder = createFolder();
    const view = createView({
      query: createFolderQuery(folder, [{ ha: { id: 'one' } }, { ha: { id: 'two' } }]),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const builder = new UnifiedQueryBuilder(
      mock<CameraManager>(),
      mock<FoldersManager>(),
    );
    const options: FolderNavigationParamaters = {
      builder,
      viewManagerEpoch: epoch,
      limit: 50,
    };

    navigateUp(options);

    const query = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0][0]?.params?.query as UnifiedQuery;
    expect(query.getNodes()[0].limit).toBe(50);
  });
});

describe('navigateToFolder', () => {
  it('should do nothing with null options', () => {
    const folder = createFolder();
    const item = new ViewFolder(folder, [{ ha: { id: 'root' } }]);

    navigateToFolder(item, null);

    // No error thrown
  });

  it('should navigate into folder', () => {
    const api = createCardAPI();
    const folder = createFolder();
    const view = createView({
      query: createFolderQuery(folder, [{ ha: { id: 'root' } }]),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const builder = new UnifiedQueryBuilder(
      mock<CameraManager>(),
      mock<FoldersManager>(),
    );
    const options: FolderNavigationParamaters = {
      builder,
      viewManagerEpoch: epoch,
    };

    const item = new ViewFolder(folder, [{ ha: { id: 'root' } }]);
    navigateToFolder(item, options);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).toBeCalledWith({
      params: {
        query: expect.any(UnifiedQuery),
      },
    });

    const query = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0][0]?.params?.query;
    const nodes = query?.getNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes?.[0]).toMatchObject({
      source: QuerySource.Folder,
      folder,
    });
    expect(nodes?.[0]).toHaveProperty('path');
    expect((nodes?.[0] as { path: readonly unknown[] }).path).toHaveLength(2);
  });

  it('should navigate into folder with limit', () => {
    const api = createCardAPI();
    const folder = createFolder();
    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    const builder = new UnifiedQueryBuilder(
      mock<CameraManager>(),
      mock<FoldersManager>(),
    );
    const options: FolderNavigationParamaters = {
      builder,
      viewManagerEpoch: epoch,
      limit: 100,
    };

    const item = new ViewFolder(folder, [{ ha: { id: 'root' } }]);
    navigateToFolder(item, options);

    const query = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0][0]?.params?.query;
    expect(query?.getNodes()[0].limit).toBe(100);
  });
});

describe('getUpFolderItem', () => {
  it('should return null for null query', () => {
    expect(getUpFolderItem(null)).toBeNull();
  });

  it('should return null for non-folder query', () => {
    expect(getUpFolderItem(createCameraQuery())).toBeNull();
  });

  it('should return null for folder query with single path element', () => {
    const folder = createFolder();
    expect(
      getUpFolderItem(createFolderQuery(folder, [{ ha: { id: 'root' } }])),
    ).toBeNull();
  });

  it('should return ViewFolder for navigable folder query', () => {
    const folder = createFolder();
    const query = createFolderQuery(folder, [
      { ha: { id: 'one' } },
      { ha: { id: 'two' } },
      { ha: { id: 'three' } },
    ]);

    const folderItem = getUpFolderItem(query);

    expect(folderItem).toBeInstanceOf(ViewFolder);
    expect(folderItem?.getIcon()).toBe('mdi:arrow-up-left');
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

    expect(api.getViewManager().setViewByParameters).toBeCalledWith(
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

    expect(api.getViewManager().setViewByParameters).toBeCalledWith(
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

    expect(api.getViewManager().setViewByParameters).toBeCalledWith(
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

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
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

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });
});
