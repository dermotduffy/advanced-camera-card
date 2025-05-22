import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { setFoldersFromConfig } from '../../../src/card-controller/config/load-folders';
import { FoldersManager } from '../../../src/card-controller/folders/manager';
import { createCardAPI, createConfig, createFolder } from '../../test-utils';

describe('setFoldersFromConfig', () => {
  it('should replace folders', () => {
    const api = createCardAPI();
    const foldersManager = mock<FoldersManager>();
    vi.mocked(api.getFoldersManager).mockReturnValue(foldersManager);

    const folders = [createFolder()];
    const config = createConfig({
      folders,
    });
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);

    setFoldersFromConfig(api);

    expect(foldersManager.deleteFolders).toBeCalled();
    expect(foldersManager.addFolders).toBeCalledWith(folders);
  });

  it('should handle exceptions', () => {
    const api = createCardAPI();
    const foldersManager = mock<FoldersManager>();
    vi.mocked(api.getFoldersManager).mockReturnValue(foldersManager);

    const error = new Error('test error');
    vi.mocked(foldersManager.addFolders).mockImplementation(() => {
      throw error;
    });

    const config = createConfig({
      folders: [createFolder()],
    });
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(config);

    setFoldersFromConfig(api);

    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });
});
