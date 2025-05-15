import { describe, expect, it, vi } from 'vitest';
import { FolderAction } from '../../../../src/card-controller/actions/actions/folder';
import { FolderQuery } from '../../../../src/card-controller/folders/types';
import { FolderViewQuery } from '../../../../src/view/query';
import { createCardAPI, createFolder } from '../../../test-utils';

describe('should handle folder action', async () => {
  it('should handle folder action successfully', async () => {
    const api = createCardAPI();
    const action = new FolderAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'folder',
      },
    );

    const folder = createFolder();
    vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(folder);

    const query: FolderQuery = {
      folder,
      path: ['path'],
    };
    vi.mocked(api.getFoldersManager().generateDefaultFolderQuery).mockReturnValue(query);

    await action.execute(api);

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).toHaveBeenCalledWith({
      params: {
        view: 'folder',
        query: expect.any(FolderViewQuery),
      },
    });

    expect(
      vi
        .mocked(api.getViewManager().setViewByParametersWithExistingQuery)
        .mock.calls[0][0]?.params?.query?.getQuery(),
    ).toBe(query);
  });

  it('should do nothing with non-existent folder', async () => {
    const api = createCardAPI();
    const action = new FolderAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'folder',
        folder: 'NON-EXISTENT-FOLDER',
      },
    );

    vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(null);

    await action.execute(api);

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
  });

  it('should do nothing with non-existent default query', async () => {
    const api = createCardAPI();
    const action = new FolderAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'folder',
      },
    );

    const folder = createFolder();
    vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(folder);

    vi.mocked(api.getFoldersManager().generateDefaultFolderQuery).mockReturnValue(null);

    await action.execute(api);

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
  });
});
