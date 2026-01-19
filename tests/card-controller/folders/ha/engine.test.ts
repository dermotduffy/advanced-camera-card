import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HAFoldersEngine } from '../../../../src/card-controller/folders/ha/engine';
import { FolderQuery } from '../../../../src/card-controller/folders/types';
import { FolderConfig, Matcher } from '../../../../src/config/schema/folders';
import { BrowseMediaViewFolder } from '../../../../src/ha/browse-media/item';
import { browseMediaSchema } from '../../../../src/ha/browse-media/types';
import { getMediaDownloadPath } from '../../../../src/ha/download';
import { homeAssistantWSRequest } from '../../../../src/ha/ws-request';
import { QuerySource } from '../../../../src/query-source';
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
      const item = new ViewFolder(createFolder(), []);
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
      const item = new ViewFolder(createFolder(), []);
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

  describe('getDefaultQueryParameters', () => {
    it('should return null for non-ha folder config', () => {
      const folder: FolderConfig = {
        type: 'UNKNOWN',
      } as unknown as FolderConfig;
      const engine = new HAFoldersEngine();

      expect(engine.getDefaultQueryParameters(folder)).toBeNull();
    });

    it('should return default query parameters for ha folder config', () => {
      const folder = createFolder();
      const engine = new HAFoldersEngine();

      expect(engine.getDefaultQueryParameters(folder)).toEqual({
        source: QuerySource.Folder,
        folder: folder,
        path: [{ ha: { id: 'media-source://' } }],
      });
    });
  });

  describe('should expand folder', () => {
    it('should reject folders of the wrong type', async () => {
      const query = {
        source: QuerySource.Folder,
        folder: { type: 'UNKNOWN' },
      } as unknown as FolderQuery;
      const engine = new HAFoldersEngine();

      expect(await engine.expandFolder(createHASS(), query)).toBeNull();
    });

    it('should expand folder with cache by default', async () => {
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [{ ha: { id: 'media-source://id' } }],
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
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [{ ha: { id: 'media-source://id' } }],
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
      const results = await engine.expandFolder(
        createHASS(),
        query,
        {},
        {
          useCache: false,
        },
      );
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);

      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      // Expanding the folder again should use the cache.
      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toBeCalledTimes(2);
    });

    it('should use id from browsemedia in folder in query', async () => {
      const browseMedia = createBrowseMedia({
        media_content_id: 'media-source://id',
        can_expand: true,
      });

      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [
          {
            folder: new BrowseMediaViewFolder(createFolder(), [], browseMedia),
          },
        ],
      };

      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(
        createBrowseMedia({
          media_content_id: 'media-source://id',
          can_expand: true,
          children: [],
        }),
      );

      const hass = createHASS();
      const engine = new HAFoldersEngine();
      await engine.expandFolder(hass, query);

      expect(homeAssistantWSRequest).toBeCalledWith(hass, browseMediaSchema, {
        type: 'media_source/browse_media',
        media_content_id: 'media-source://id',
      });
    });

    it('should not expand without a folder with an id', async () => {
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        // There's no component in the query with an id to start from.
        path: [{ ha: {} }],
      };
      const engine = new HAFoldersEngine();
      expect(await engine.expandFolder(createHASS(), query)).toBeNull();
    });

    it('should early exit when limit is reached', async () => {
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [{ ha: { id: 'media-source://id' } }],
        limit: 1,
      };

      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(
        createBrowseMedia({
          media_content_id: 'media-source://id',
          can_expand: true,
          children: [
            createBrowseMedia({
              media_content_id: 'media-source://media-item-1',
              title: 'Media Item 1',
            }),
            createBrowseMedia({
              media_content_id: 'media-source://media-item-2',
              title: 'Media Item 2',
            }),
          ],
        }),
      );

      const engine = new HAFoldersEngine();
      const results = await engine.expandFolder(createHASS(), query);

      // Even though there are 2 children, the limit of 1 should trigger earlyExit.
      expect(results?.length).toBe(1);
    });

    // See additional matcher testing in media-matcher.test.ts .
    describe('should apply matchers', async () => {
      it.each([
        ['title exact', { type: 'title' as const, title: 'Frigate' }, 1],
        ['title regexp', { type: 'title' as const, regexp: 'rig' }, 1],
        [
          'or positive',
          {
            type: 'or' as const,
            matchers: [
              { type: 'title' as const, title: 'UNKNOWN' },
              { type: 'title' as const, title: 'Frigate' },
            ],
          },
          1,
        ],
        [
          'or negative',
          {
            type: 'or' as const,
            matchers: [{ type: 'title' as const, title: 'UNKNOWN' }],
          },
          0,
        ],
      ])('%s', async (_name: string, matcher: Matcher, expectedMatches: number) => {
        const query: FolderQuery = {
          source: QuerySource.Folder,
          folder: { type: 'ha', id: 'test' },
          path: [{ ha: { id: 'media-source://' } }, { ha: { matchers: [matcher] } }, {}],
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
        expect(results?.length).toBe(expectedMatches);
      });
    });
  });

  describe('generateChildFolderQuery', () => {
    it('should return null if folder type is not ha', () => {
      const engine = new HAFoldersEngine();
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'other' } as unknown as FolderConfig,
        path: [{ ha: { id: 'root' } }],
      };
      const folder = new ViewFolder(createFolder(), []);

      expect(engine.generateChildFolderQuery(query, folder)).toBeNull();
    });

    it('should return null if folder has no id', () => {
      const engine = new HAFoldersEngine();
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [{ ha: { id: 'root' } }],
      };
      const folder = new ViewFolder(createFolder(), [], { id: '' });

      expect(engine.generateChildFolderQuery(query, folder)).toBeNull();
    });

    it('should extend query with configured component', () => {
      const engine = new HAFoldersEngine();
      const folderConfig: FolderConfig = {
        type: 'ha',
        id: 'test',
        ha: {
          path: [{ id: 'child', matchers: [{ type: 'title', title: 'foo' }] }],
        },
      };
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: folderConfig,
        path: [{ ha: { id: 'media-source://' } }],
      };
      const folder = new ViewFolder(createFolder(), [], { id: 'child' });

      const result = engine.generateChildFolderQuery(query, folder);

      expect(result).toEqual({
        source: QuerySource.Folder,
        folder: folderConfig,
        path: [
          { ha: { id: 'media-source://' } },
          {
            folder,
            ha: { id: 'child', matchers: [{ type: 'title', title: 'foo' }] },
          },
        ],
      });
    });

    it('should extend query with default component when no configuration exists', () => {
      const engine = new HAFoldersEngine();
      const folderConfig: FolderConfig = { type: 'ha', id: 'test' };
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: folderConfig,
        path: [{ ha: { id: 'media-source://' } }],
      };
      const folder = new ViewFolder(createFolder(), [], { id: 'child' });

      const result = engine.generateChildFolderQuery(query, folder);

      expect(result).toEqual({
        source: QuerySource.Folder,
        folder: folderConfig,
        path: [
          { ha: { id: 'media-source://' } },
          {
            folder,
            ha: { id: 'child' },
          },
        ],
      });
    });
  });

  describe('areResultsFresh', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('should return true for fresh results', () => {
      const now = new Date('2026-01-02T07:54:32Z');
      vi.setSystemTime(now);

      const engine = new HAFoldersEngine();
      const query = { folder: { type: 'ha' } } as FolderQuery;
      const resultsTimestamp = new Date('2026-01-02T07:54:30Z');

      expect(engine.areResultsFresh(resultsTimestamp, query)).toBe(true);
    });

    it('should return false for stale results', () => {
      const now = new Date('2026-01-02T07:54:32Z');
      vi.setSystemTime(now);

      const engine = new HAFoldersEngine();
      const query = { folder: { type: 'ha' } } as FolderQuery;
      const resultsTimestamp = new Date('2026-01-02T07:53:30Z');

      expect(engine.areResultsFresh(resultsTimestamp, query)).toBe(false);
    });
  });
});
