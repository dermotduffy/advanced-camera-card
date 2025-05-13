import { describe, expect, it, vi } from 'vitest';
import { ViewManagerEpoch } from '../../../src/card-controller/view/types';
import {
  getUpFolderMediaItem,
  upFolderClickHandler,
} from '../../../src/components-lib/folder/up-folder';
import { ViewFolder } from '../../../src/view/item';
import { EventMediaQuery, FolderViewQuery } from '../../../src/view/query';
import {
  createCardAPI,
  createFolder,
  createView,
  TestViewMedia,
} from '../../test-utils';

describe('upFolderClickHandler', () => {
  const item = new TestViewMedia();

  it('should ignore non-folder query', () => {
    const api = createCardAPI();
    const view = createView({
      query: new EventMediaQuery(),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    upFolderClickHandler(item, new Event('click'), epoch);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should ignore folder query without raw query', () => {
    const api = createCardAPI();
    const view = createView({
      query: new FolderViewQuery(),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    upFolderClickHandler(item, new Event('click'), epoch);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should ignore folder query wihout parent to go up to', () => {
    const api = createCardAPI();
    const view = createView({
      query: new FolderViewQuery({ folder: createFolder(), parentPaths: [] }),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    upFolderClickHandler(item, new Event('click'), epoch);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should go up in the folder hierarchy', () => {
    const api = createCardAPI();
    const folder = createFolder();
    const view = createView({
      query: new FolderViewQuery({
        folder,
        parentPaths: ['one', 'two', 'three'],
      }),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const epoch: ViewManagerEpoch = {
      manager: api.getViewManager(),
    };

    upFolderClickHandler(item, new Event('click'), epoch);

    expect(api.getViewManager().setViewByParametersWithExistingQuery).toBeCalledWith({
      params: {
        query: expect.any(FolderViewQuery),
      },
    });

    const query = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0][0]?.params?.query;
    expect(query?.getQuery()).toEqual({
      folder,
      path: 'two',
      parentPaths: ['one', 'two'],
    });
  });
});

describe('getUpFolderMediaItem', () => {
  it('should ignore non-folder query', () => {
    const view = createView({
      query: new EventMediaQuery(),
    });
    expect(getUpFolderMediaItem(view)).toBeNull();
  });

  it('should ignore folder query without raw query', () => {
    const view = createView({
      query: new FolderViewQuery(),
    });
    expect(getUpFolderMediaItem(view)).toBeNull();
  });

  it('should ignore folder query without parents', () => {
    const view = createView({
      query: new FolderViewQuery({ folder: createFolder(), parentPaths: [] }),
    });
    expect(getUpFolderMediaItem(view)).toBeNull();
  });

  it('should get up folder media', () => {
    const view = createView({
      query: new FolderViewQuery({
        folder: createFolder(),
        parentPaths: ['one', 'two', 'three'],
      }),
    });

    const folderMedia = getUpFolderMediaItem(view);

    expect(folderMedia).toBeInstanceOf(ViewFolder);
    expect(folderMedia?.getIcon()).toBe('mdi:arrow-up-right');
  });
});
