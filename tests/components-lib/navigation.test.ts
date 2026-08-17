import type { NonEmptyTuple } from 'type-fest';
import { assert, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManager } from '../../src/camera-manager/manager';
import { QueryType, type EventQuery } from '../../src/camera-manager/types';
import type { FoldersManager } from '../../src/card-controller/folders/manager';
import type { FolderPathComponent } from '../../src/card-controller/folders/types';
import type {
  ViewManagerEpoch,
  ViewModifier,
} from '../../src/card-controller/view/types';
import {
  getUpFolderItem,
  navigateToFolder,
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

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
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

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
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

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).toHaveBeenCalledWith({
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

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).toHaveBeenCalledWith({
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
