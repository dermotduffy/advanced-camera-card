import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { HAFoldersEngine } from '../../../../src/card-controller/folders/ha/engine';
import { FolderQuery } from '../../../../src/card-controller/folders/types';
import { FolderConfig } from '../../../../src/config/schema/folders';
import { BrowseMediaCache } from '../../../../src/ha/browse-media/types';
import { BrowseMediaWalker } from '../../../../src/ha/browse-media/walker';
import { getMediaDownloadPath } from '../../../../src/ha/download';
import { Endpoint } from '../../../../src/types';
import { ViewFolder, ViewMedia } from '../../../../src/view/item';
import {
  createBrowseMedia,
  createFolder,
  createHASS,
  TestViewMedia,
} from '../../../test-utils';

vi.mock('../../../../src/ha/download');

describe('HAFoldersEngine', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getItemCapabilities', () => {
    it('should not be able to download a folder', () => {
      const item = new ViewFolder(createFolder());
      const engine = new HAFoldersEngine();

      expect(engine.getItemCapabilities(item)).toEqual({
        canFavorite: false,
        canDownload: false,
      });
    });

    it('should be able to download a media item', () => {
      const item = new TestViewMedia({ folder: createFolder() });
      const engine = new HAFoldersEngine();

      expect(engine.getItemCapabilities(item)).toEqual({
        canFavorite: false,
        canDownload: true,
      });
    });
  });

  describe('getDownloadPath', () => {
    it('should return null if item is not a media item', async () => {
      const item = new ViewFolder(createFolder());
      const engine = new HAFoldersEngine();
      expect(await engine.getDownloadPath(createHASS(), item)).toBeNull();
    });

    it('should return a download path for a media item', async () => {
      const item = new TestViewMedia({ folder: createFolder() });
      const engine = new HAFoldersEngine();

      const endpoint: Endpoint = { endpoint: '/media', sign: false };
      vi.mocked(getMediaDownloadPath).mockResolvedValue(endpoint);

      expect(await engine.getDownloadPath(createHASS(), item)).toEqual(endpoint);
    });
  });

  describe('favorite', () => {
    it('should favorite', async () => {
      const engine = new HAFoldersEngine();
      const item = new TestViewMedia({ folder: createFolder() });

      await engine.favorite(createHASS(), item, true);

      // No observable effect.
    });
  });

  describe('expandFolder', () => {
    it('should reject folders of the wrong type', async () => {
      const query = {
        folder: { type: 'UNKNOWN' },
      } as unknown as FolderQuery;
      const engine = new HAFoldersEngine();

      expect(await engine.expandFolder(createHASS(), query)).toBeNull();
    });
  });

  describe('should generate default folder query', () => {
    it('should generate default folder query', () => {
      const folder: FolderConfig = { type: 'ha' };
      const engine = new HAFoldersEngine();

      const query = engine.generateDefaultFolderQuery(folder);
      expect(query).toEqual({
        folder,
        path: ['media-source://'],
      });
    });

    it('should reject folders of the wrong type', async () => {
      const folder = createFolder({ type: 'UNKNOWN' } as unknown as FolderConfig);
      const engine = new HAFoldersEngine();

      expect(engine.generateDefaultFolderQuery(folder)).toBeNull();
    });

    it('should respect configured path', async () => {
      const folder = createFolder({
        ha: {
          path: ['media-source://1'],
          // path_url should be ignored because path is set.
          path_url: ['media-source://2'],
        },
      });
      const engine = new HAFoldersEngine();
      expect(engine.generateDefaultFolderQuery(folder)).toEqual({
        folder,
        path: ['media-source://1'],
      });
    });

    it('should respect configured path_url', async () => {
      const folder = createFolder({ ha: { path_url: ['media-source://'] } });
      const engine = new HAFoldersEngine();
      expect(engine.generateDefaultFolderQuery(folder)).toEqual({
        folder,
        path: ['media-source://'],
      });
    });
  });

  describe('should expand folder', () => {
    it('should expand folder with cache by default', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: ['path'],
      };

      const browseMediaManager = mock<BrowseMediaWalker>();
      browseMediaManager.walk.mockResolvedValue([
        createBrowseMedia({ media_content_id: 'one' }),
        { ...createBrowseMedia({ can_expand: true, media_content_id: 'two' }) },
      ]);

      const engine = new HAFoldersEngine(browseMediaManager);
      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);

      expect(browseMediaManager.walk).toBeCalledWith(
        expect.anything(),
        [
          {
            targets: ['path'],
          },
        ],
        {
          cache: expect.any(BrowseMediaCache),
        },
      );
    });

    it('should expand folder without cache when requested', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: ['path'],
      };

      const browseMediaManager = mock<BrowseMediaWalker>();
      browseMediaManager.walk.mockResolvedValue([
        createBrowseMedia({ media_content_id: 'one' }),
        { ...createBrowseMedia({ can_expand: true, media_content_id: 'two' }) },
      ]);

      const engine = new HAFoldersEngine(browseMediaManager);
      await engine.expandFolder(createHASS(), query, { useCache: false });

      expect(browseMediaManager.walk).toBeCalledWith(
        expect.anything(),
        [
          {
            targets: ['path'],
          },
        ],
        {},
      );
    });
  });
});
