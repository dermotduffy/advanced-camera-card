import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { FoldersExecutor } from '../../../src/card-controller/folders/executor';
import { HAFoldersEngine } from '../../../src/card-controller/folders/ha/engine';
import { FolderQuery } from '../../../src/card-controller/folders/types';
import { FolderConfig } from '../../../src/config/schema/folders';
import { Endpoint } from '../../../src/types';
import { ViewFolder } from '../../../src/view/item';
import { createFolder, createHASS, TestViewMedia } from '../../test-utils';

vi.mock('../../../src/card-controller/folders/ha/engine');
vi.mock('../../../../src/utils/ha/download');

describe('FoldersExecutor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getItemCapabilities', () => {
    it('should not get capabilities for non-folder media', () => {
      const item = new TestViewMedia({ folder: null });
      const executor = new FoldersExecutor();

      expect(executor.getItemCapabilities(item)).toBeNull();
    });

    it('should not get capabilities for non-existent folder engine', () => {
      const folder: FolderConfig = {
        type: 'UNKNOWN',
      } as unknown as FolderConfig;
      const item = new TestViewMedia({ folder });
      const executor = new FoldersExecutor();

      expect(executor.getItemCapabilities(item)).toBeNull();
    });

    it('should get capabilities for HA folder engine', () => {
      const folder = createFolder();
      const item = new TestViewMedia({ folder });

      const capabilities = {
        canFavorite: false,
        canDownload: true,
      };
      const haFolderEngine = mock<HAFoldersEngine>();
      haFolderEngine.getItemCapabilities.mockReturnValue(capabilities);

      const executor = new FoldersExecutor({
        ha: haFolderEngine,
      });

      expect(executor.getItemCapabilities(item)).toEqual(capabilities);
    });
  });

  describe('getDownloadPath', () => {
    it('should not get download path for non-existent folder engine', async () => {
      const folder: FolderConfig = {
        type: 'UNKNOWN',
      } as unknown as FolderConfig;
      const item = new TestViewMedia({ folder });
      const executor = new FoldersExecutor();

      expect(await executor.getDownloadPath(createHASS(), item)).toBeNull();
    });

    it('should get download path for HA folder engine', async () => {
      const endpoint: Endpoint = { endpoint: '/media', sign: false };
      const haFolderEngine = mock<HAFoldersEngine>();
      haFolderEngine.getDownloadPath.mockResolvedValue(endpoint);

      const executor = new FoldersExecutor({
        ha: haFolderEngine,
      });
      const item = new TestViewMedia({ folder: createFolder() });
      expect(await executor.getDownloadPath(createHASS(), item)).toEqual(endpoint);
    });
  });

  describe('favorite', () => {
    it('should not favorite non-existent folder engine', async () => {
      const folder: FolderConfig = {
        type: 'UNKNOWN',
      } as unknown as FolderConfig;
      const item = new TestViewMedia({ folder });
      const executor = new FoldersExecutor();

      await executor.favorite(createHASS(), item, true);

      // No observable effect.
    });

    it('should favorite', async () => {
      const haFolderEngine = mock<HAFoldersEngine>();
      const executor = new FoldersExecutor({
        ha: haFolderEngine,
      });

      const hass = createHASS();
      const item = new TestViewMedia({ folder: createFolder() });

      await executor.favorite(hass, item, true);

      expect(haFolderEngine.favorite).toBeCalledWith(hass, item, true);
    });
  });

  describe('expandFolder', () => {
    it('should reject folders of the wrong type', async () => {
      const query = {
        folder: { type: 'UNKNOWN' },
      } as unknown as FolderQuery;

      const executor = new FoldersExecutor();

      expect(await executor.expandFolder(createHASS(), query)).toBeNull();
    });

    it('should expand folder', async () => {
      const folder = createFolder();
      const query: FolderQuery = {
        folder,
      };

      const mediaItem = new TestViewMedia({
        folder,
        startTime: new Date('2023-04-29T14:27'),
      });
      const folderItem = new ViewFolder(folder);

      const haFolderEngine = mock<HAFoldersEngine>();
      haFolderEngine.expandFolder.mockResolvedValue([folderItem, mediaItem, folderItem]);

      const executor = new FoldersExecutor({
        ha: haFolderEngine,
      });
      const hass = createHASS();
      const results = await executor.expandFolder(hass, query);
      expect(results).toEqual([
        // Folder will have been sorted to the front and de-duped.
        folderItem,
        mediaItem,
      ]);
    });
  });
});
