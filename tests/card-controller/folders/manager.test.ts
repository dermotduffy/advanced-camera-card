import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { FoldersExecutor } from '../../../src/card-controller/folders/executor';
import { FoldersManager } from '../../../src/card-controller/folders/manager';
import { FolderQuery } from '../../../src/card-controller/folders/types';
import { FolderConfig, FolderConfigWithoutID } from '../../../src/config/schema/folders';
import { ResolvedMediaCache } from '../../../src/ha/resolved-media';
import { Endpoint } from '../../../src/types';
import { ViewFolder } from '../../../src/view/item';
import { ViewItemCapabilities } from '../../../src/view/types';
import {
  createCardAPI,
  createFolder,
  createHASS,
  TestViewMedia,
} from '../../test-utils';

describe('FoldersManager', () => {
  it('should initialize with no folders', () => {
    const api = createCardAPI();
    const manager = new FoldersManager(api);
    expect(manager.getFolderCount()).toBe(0);
    expect(manager.hasFolders()).toBe(false);
  });

  describe('should add folders', () => {
    it('should add a folder correctly without a title', () => {
      const manager = new FoldersManager(createCardAPI());
      const folder = createFolder({ id: 'folder-1' });

      manager.addFolders([folder]);
      expect(manager.getFolderCount()).toBe(1);
      expect(manager.getFolder('folder-1')).toEqual({
        ...folder,
        title: 'Folder 0',
      });
      expect(manager.hasFolders()).toBe(true);
    });

    it('should add a folder correctly with a title', () => {
      const manager = new FoldersManager(createCardAPI());
      const folder = createFolder({ id: 'folder-1', title: 'Original Title' });

      manager.addFolders([folder]);
      expect(manager.getFolderCount()).toBe(1);
      expect(manager.getFolder('folder-1')).toEqual(folder);
    });

    it('should add a folder without an id', () => {
      const manager = new FoldersManager(createCardAPI());
      const folder: FolderConfigWithoutID = {
        type: 'ha' as const,
        title: 'Title',
        ha: {
          path: [{ id: 'media-source://' }],
        },
      };

      manager.addFolders([folder]);
      expect(manager.getFolderCount()).toBe(1);
      expect(manager.getFolder('folder/0')).toEqual({
        ...folder,
        id: 'folder/0',
      });
    });

    it('should reject duplicate folder IDs', () => {
      const manager = new FoldersManager(createCardAPI());
      const folder_1 = createFolder({ id: 'DUP' });
      const folder_2 = createFolder({ id: 'DUP' });

      expect(() => manager.addFolders([folder_1, folder_2])).toThrowError(
        /Duplicate folder id/,
      );
    });

    it('should preserve previous folders', () => {
      const manager = new FoldersManager(createCardAPI());

      const folder_original = createFolder();
      manager.addFolders([folder_original]);

      const folder_new = createFolder({ id: 'DUP' });
      manager.addFolders([folder_new]);

      expect(manager.getFolderCount()).toBe(2);
    });
  });

  it('should delete folders', () => {
    const manager = new FoldersManager(createCardAPI());
    const folder_1 = createFolder({ id: 'id-1' });
    const folder_2 = createFolder({ id: 'id-2' });

    manager.addFolders([folder_1, folder_2]);
    expect(manager.getFolderCount()).toBe(2);

    manager.deleteFolders();
    expect(manager.getFolderCount()).toBe(0);
  });

  describe('should get folders', () => {
    it('should get default folder', () => {
      const manager = new FoldersManager(createCardAPI());
      const folder = createFolder({ id: 'id', title: 'Title' });
      manager.addFolders([folder]);

      expect(manager.getFolder()).toEqual(folder);
    });

    it('should get default folders when there are none', () => {
      const manager = new FoldersManager(createCardAPI());
      expect(manager.getFolder()).toBeNull();
    });

    it('should get all folders', () => {
      const manager = new FoldersManager(createCardAPI());
      const folder_1 = createFolder({ id: 'id-1', title: 'Title' });
      const folder_2 = createFolder({ id: 'id-2', title: 'Title' });

      manager.addFolders([folder_1, folder_2]);

      expect([...manager.getFolders()]).toEqual([
        ['id-1', folder_1],
        ['id-2', folder_2],
      ]);
    });

    it('should get non-existent folder', () => {
      const manager = new FoldersManager(createCardAPI());
      expect(manager.getFolder('NON-EXISTENT')).toBeNull();
    });
  });

  describe('generateDefaultFolderQuery', () => {
    it('should generate default folder query with implicit folder', () => {
      const folder: FolderConfig = createFolder();
      const query: FolderQuery = {
        folder,
        path: [{ ha: { id: 'media-source://' } }],
      };

      const executor = mock<FoldersExecutor>();
      vi.mocked(executor.generateDefaultFolderQuery).mockReturnValue(query);

      const manager = new FoldersManager(createCardAPI(), executor);
      manager.addFolders([folder]);

      expect(manager.generateDefaultFolderQuery()).toEqual(query);
    });

    it('should generate default folder query without any folder', () => {
      const folder: FolderConfig = createFolder();
      const query: FolderQuery = {
        folder,
        path: [{ ha: { id: 'media-source://' } }],
      };

      const executor = mock<FoldersExecutor>();
      vi.mocked(executor.generateDefaultFolderQuery).mockReturnValue(query);

      const manager = new FoldersManager(createCardAPI(), executor);
      // Folder is not added to the manager.

      expect(manager.generateDefaultFolderQuery()).toBeNull();
    });

    it('should generate default folder query with explicit folder', () => {
      const folder: FolderConfig = createFolder();
      const query: FolderQuery = {
        folder,
        path: [{ ha: { id: 'media-source://' } }],
      };

      const executor = mock<FoldersExecutor>();
      vi.mocked(executor.generateDefaultFolderQuery).mockReturnValue(query);

      const manager = new FoldersManager(createCardAPI(), executor);

      expect(manager.generateDefaultFolderQuery(folder)).toEqual(query);
    });
  });

  describe('generateChildFolderQuery', () => {
    it('should generate child folder query', () => {
      const folder: FolderConfig = createFolder();
      const query: FolderQuery = {
        folder,
        path: [{ ha: { id: 'media-source://' } }],
      };
      const viewFolder = new ViewFolder(folder);

      const executor = mock<FoldersExecutor>();
      vi.mocked(executor.generateChildFolderQuery).mockReturnValue(query);

      const manager = new FoldersManager(createCardAPI(), executor);

      expect(manager.generateChildFolderQuery(query, viewFolder)).toEqual(query);
      expect(executor.generateChildFolderQuery).toBeCalledWith(query, viewFolder);
    });
  });

  describe('should expand folder', () => {
    it('should expand folder with hass', async () => {
      const hass = createHASS();
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const media = new TestViewMedia();
      const executor = mock<FoldersExecutor>();
      executor.expandFolder.mockResolvedValue([media]);

      const manager = new FoldersManager(api, executor);

      const folder = createFolder({ id: 'folder-1' });
      const conditionState = {};
      const engineOptions = {};
      const query: FolderQuery = {
        folder,
        path: [{ ha: { id: 'media-source://' } }],
      };

      expect(await manager.expandFolder(query, conditionState, engineOptions)).toEqual([
        media,
      ]);

      expect(executor.expandFolder).toBeCalledWith(
        hass,
        query,
        conditionState,
        engineOptions,
      );
    });

    it('should not expand folder with hass', async () => {
      const api = createCardAPI();
      const executor = mock<FoldersExecutor>();
      const manager = new FoldersManager(api, executor);
      const folder = createFolder({ id: 'folder-1' });

      expect(
        await manager.expandFolder({
          folder,
          path: [{ ha: { id: 'media-source://' } }],
        }),
      ).toBeNull();

      expect(executor.expandFolder).not.toBeCalled();
    });
  });

  describe('should get item capabilities', () => {
    it('should get item capabilities', () => {
      const api = createCardAPI();
      const executor = mock<FoldersExecutor>();
      const capabilities: ViewItemCapabilities = {
        canFavorite: true,
        canDownload: true,
      };
      executor.getItemCapabilities.mockReturnValue(capabilities);
      const item = new TestViewMedia();

      const manager = new FoldersManager(api, executor);

      expect(manager.getItemCapabilities(item)).toEqual(capabilities);
      expect(executor.getItemCapabilities).toBeCalledWith(item);
    });
  });

  describe('should get download path', () => {
    it('should get download path', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
      const cache = new ResolvedMediaCache();
      vi.mocked(api.getResolvedMediaCache).mockReturnValue(cache);

      const executor = mock<FoldersExecutor>();
      const item = new TestViewMedia();
      const endpoint: Endpoint = { endpoint: 'endpoint' };
      executor.getDownloadPath.mockResolvedValue(endpoint);

      const manager = new FoldersManager(api, executor);
      expect(await manager.getDownloadPath(item)).toEqual(endpoint);
      expect(executor.getDownloadPath).toBeCalledWith(hass, item, {
        resolvedMediaCache: cache,
      });
    });
  });

  describe('should favorite item', () => {
    it('should favorite item', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const executor = mock<FoldersExecutor>();
      const item = new TestViewMedia();

      const manager = new FoldersManager(api, executor);
      await manager.favorite(item, true);
      expect(executor.favorite).toBeCalledWith(hass, item, true);
    });
  });
});
