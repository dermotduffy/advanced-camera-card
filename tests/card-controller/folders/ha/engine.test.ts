import { afterEach, describe, expect, it, vi } from 'vitest';

import { HAFoldersEngine } from '../../../../src/card-controller/folders/ha/engine';
import { FolderQuery } from '../../../../src/card-controller/folders/types';
import { FolderConfig } from '../../../../src/config/schema/folders';
import { getMediaDownloadPath } from '../../../../src/ha/download';
import { homeAssistantWSRequest } from '../../../../src/ha/ws-request';
import { Endpoint } from '../../../../src/types';
import { ViewFolder, ViewMedia } from '../../../../src/view/item';
import {
  createBrowseMedia,
  createFolder,
  createHASS,
  TestViewMedia,
} from '../../../test-utils';

vi.mock('../../../../src/ha/download');
vi.mock('../../../../src/ha/ws-request');

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
        path: [{ id: 'media-source://', ha: { id: 'media-source://' } }],
      });
    });

    it('should reject folders of the wrong type', async () => {
      const folder = createFolder({ type: 'UNKNOWN' } as unknown as FolderConfig);
      const engine = new HAFoldersEngine();

      expect(engine.generateDefaultFolderQuery(folder)).toBeNull();
    });

    it('should respect path_url as a priority', async () => {
      const folder = createFolder({
        ha: {
          url: [{ id: 'media-source://1' }],
          path: [{ id: 'media-source://2' }],
        },
      });
      const engine = new HAFoldersEngine();
      expect(engine.generateDefaultFolderQuery(folder)).toEqual({
        folder,
        path: [
          { id: 'media-source://1', ha: { id: 'media-source://1' } },
          { id: 'media-source://2', ha: { id: 'media-source://2' } },
        ],
      });
    });

    it('should respect configured url', async () => {
      const folder = createFolder({ ha: { url: [{ id: 'media-source://' }] } });
      const engine = new HAFoldersEngine();
      expect(engine.generateDefaultFolderQuery(folder)).toEqual({
        folder,
        path: [{ id: 'media-source://', ha: { id: 'media-source://' } }],
      });
    });

    it('should add default media root as necessary', async () => {
      const folder = createFolder({ ha: { path: [{ title: 'Frigate' }] } });
      const engine = new HAFoldersEngine();
      expect(engine.generateDefaultFolderQuery(folder)).toEqual({
        folder,
        path: [
          { id: 'media-source://', ha: { id: 'media-source://' } },
          { id: undefined, ha: { title: 'Frigate' } },
        ],
      });
    });
  });

  describe('should expand folder', () => {
    it('should expand folder with cache by default', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: [{ id: 'media-source://id' }],
      };

      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(
        createBrowseMedia({
          media_content_id: 'media-source://id',
          can_expand: true,
          children: [
            createBrowseMedia({
              media_content_id: 'media-source://media-item',
              title: 'Media Item',
            }),
            createBrowseMedia({
              media_content_id: 'media-source://frigate',
              title: 'Frigate',
              can_expand: true,
            }),
          ],
        }),
      );

      const engine = new HAFoldersEngine();
      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);

      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      // Expanding the folder again should use the cache.
      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);
    });

    it('should expand folder without cache when requested', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: [{ id: 'media-source://id' }],
      };

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://id',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://media-item',
                title: 'Media Item',
              }),
              createBrowseMedia({
                media_content_id: 'media-source://frigate',
                title: 'Frigate',
                can_expand: true,
              }),
            ],
          }),
        )
        .mockResolvedValueOnce([]);

      const engine = new HAFoldersEngine();
      const results = await engine.expandFolder(createHASS(), query, {
        useCache: false,
      });
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);

      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      // Expanding the folder again should use the cache.
      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toBeCalledTimes(2);
    });

    it('should not expand without a folder with an id', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        // There's no component in the query with an id to start from.
        path: [{ ha: { title: 'Frigate' } }],
      };
      const engine = new HAFoldersEngine();
      expect(await engine.expandFolder(createHASS(), query)).toBeNull();
    });

    it('should expand folder with title based query', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: [{ id: 'media-source://' }, { ha: { title: 'Frigate' } }],
      };

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate',
                title: 'Frigate',
                can_expand: true,
              }),
            ],
          }),
        )
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://frigate',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate/result',
                title: 'Result',
              }),
            ],
          }),
        );

      const engine = new HAFoldersEngine();
      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(1);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[0].getID()).toBe('media-source://frigate/result');
    });

    it('should expand folder with title_re based query', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: [{ id: 'media-source://' }, { ha: { title_re: 'Fri.*' } }],
      };

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate',
                title: 'Frigate',
                can_expand: true,
              }),
            ],
          }),
        )
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://frigate',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate/result',
                title: 'Result',
              }),
            ],
          }),
        );

      const engine = new HAFoldersEngine();
      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(1);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[0].getID()).toBe('media-source://frigate/result');
    });

    it('should expand folder with ha id based query', async () => {
      const query: FolderQuery = {
        folder: { type: 'ha' },
        path: [
          { id: 'media-source://' },
          { ha: { title: 'Frigate' } },
          { id: 'media-source://frigate/subdir' },
        ],
      };

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate',
                title: 'Frigate',
                can_expand: true,
              }),
            ],
          }),
        )
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://frigate',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate/subdir',
                can_expand: true,
              }),
            ],
          }),
        )
        .mockResolvedValueOnce(
          createBrowseMedia({
            media_content_id: 'media-source://frigate/subdir',
            can_expand: true,
            children: [
              createBrowseMedia({
                media_content_id: 'media-source://frigate/subdir/result',
                title: 'Result',
              }),
            ],
          }),
        );

      const engine = new HAFoldersEngine();
      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(1);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[0].getID()).toBe('media-source://frigate/subdir/result');
    });
  });
});
