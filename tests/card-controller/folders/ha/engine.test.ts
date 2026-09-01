import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { HAFoldersEngine } from '../../../../src/card-controller/folders/ha/engine';
import type { FolderQuery } from '../../../../src/card-controller/folders/types';
import { TemplateManager } from '../../../../src/card-controller/templates';
import type { FolderConfig, Matcher } from '../../../../src/config/schema/folders';
import { BrowseMediaViewFolder } from '../../../../src/ha/browse-media/item';
import {
  browseMediaSchema,
  type BrowseMedia,
} from '../../../../src/ha/browse-media/types';
import { getMediaDownloadPath } from '../../../../src/ha/download';
import { homeAssistantWSRequest } from '../../../../src/ha/ws-request';
import { QuerySource } from '../../../../src/query-source';
import type { Endpoint } from '../../../../src/types';
import { ViewFolder, ViewMedia } from '../../../../src/view/item';
import { createBrowseMedia, createFolder, createHASS } from '../../../test-utils';
import { TestViewMedia } from '../../../view/test-utils';

vi.mock('../../../../src/ha/download');
vi.mock('../../../../src/ha/ws-request');

describe('HAFoldersEngine', () => {
  const templateManager = new TemplateManager();

  afterEach(() => {
    // Reset rather than clear, as tests queue browse responses with
    // mockResolvedValueOnce and a test that matches nothing leaves some
    // unconsumed.
    vi.resetAllMocks();
  });

  describe('getItemCapabilities', () => {
    it('should not be able to download a folder', () => {
      const item = new ViewFolder(createFolder(), []);
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getItemCapabilities(item)).toEqual({
        canFavorite: false,
        canDownload: false,
      });
    });

    it('should be able to download a media item', () => {
      const item = new TestViewMedia({ folder: createFolder() });
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getItemCapabilities(item)).toEqual({
        canFavorite: false,
        canDownload: true,
      });
    });
  });

  describe('getDownloadPath', () => {
    it('should return null if item is not a media item', async () => {
      const item = new ViewFolder(createFolder(), []);
      const engine = new HAFoldersEngine(templateManager);
      expect(await engine.getDownloadPath(createHASS(), item)).toBeNull();
    });

    it('should return a download path for a media item', async () => {
      const item = new TestViewMedia({ folder: createFolder() });
      const engine = new HAFoldersEngine(templateManager);

      const endpoint: Endpoint = { endpoint: '/media', sign: false };
      vi.mocked(getMediaDownloadPath).mockResolvedValue(endpoint);

      expect(await engine.getDownloadPath(createHASS(), item)).toEqual(endpoint);
    });
  });

  describe('favorite', () => {
    it('should favorite', async () => {
      const engine = new HAFoldersEngine(templateManager);
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
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getDefaultQueryParameters(folder)).toBeNull();
    });

    it('should return default query parameters for ha folder config', () => {
      const folder = createFolder();
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getDefaultQueryParameters(folder)).toEqual({
        source: QuerySource.Folder,
        folder: folder,
        path: [{ ha: { id: 'media-source://' } }],
      });
    });

    it('should start at the media source root when no path is configured', () => {
      const folder: FolderConfig = { type: 'ha', id: 'test' };
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getDefaultQueryParameters(folder)).toEqual({
        source: QuerySource.Folder,
        folder,
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
      const engine = new HAFoldersEngine(templateManager);

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

      const engine = new HAFoldersEngine(templateManager);
      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);

      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(1);

      // Expanding the folder again should use the cache.
      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(1);
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

      const engine = new HAFoldersEngine(templateManager);
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

      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(1);

      // Expanding the folder again should use the cache.
      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(2);
    });

    it('should browse only the folder that was navigated into', async () => {
      const LANDING = 'media-source://media_source/local/Landing';
      const DAY = `${LANDING}/2026-08-28`;
      const IMAGES = `${LANDING}/images`;

      const dayBrowseMedia = createBrowseMedia({
        media_content_id: DAY,
        title: '2026-08-28',
        can_expand: true,
      });

      const tree: Record<string, BrowseMedia> = {
        [LANDING]: createBrowseMedia({
          media_content_id: LANDING,
          can_expand: true,
          children: [
            dayBrowseMedia,
            createBrowseMedia({
              media_content_id: IMAGES,
              title: 'images',
              can_expand: true,
            }),
          ],
        }),
        [DAY]: createBrowseMedia({
          media_content_id: DAY,
          can_expand: true,
          children: [
            createBrowseMedia({ media_content_id: `${DAY}/one.mp4`, title: 'one.mp4' }),
          ],
        }),
        [IMAGES]: createBrowseMedia({
          media_content_id: IMAGES,
          can_expand: true,
          children: [
            createBrowseMedia({
              media_content_id: `${IMAGES}/2026-08-28.jpg`,
              title: '2026-08-28.jpg',
            }),
          ],
        }),
      };

      vi.mocked(homeAssistantWSRequest).mockImplementation(
        async (_hass, _schema, request) => {
          const mediaContentID: unknown = request.media_content_id;
          return typeof mediaContentID === 'string' ? tree[mediaContentID] : null;
        },
      );

      // The path after the user clicks into the `2026-08-28` folder, which is
      // added after the parser component that found it.
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [
          { ha: { id: LANDING } },
          { ha: { parsers: [{ type: 'thumbnail' }] } },
          { folder: new BrowseMediaViewFolder(createFolder(), [], dayBrowseMedia) },
        ],
      };

      const engine = new HAFoldersEngine(templateManager);
      const results = await engine.expandFolder(createHASS(), query);

      expect(results?.map((item) => item.getTitle())).toEqual(['one.mp4']);
    });

    it('should browse the deepest configured id in the path', async () => {
      const LANDING = 'media-source://media_source/local/Landing';
      const DAY = `${LANDING}/2026-08-28`;
      const IMAGES = `${LANDING}/images`;

      const tree: Record<string, BrowseMedia> = {
        [LANDING]: createBrowseMedia({
          media_content_id: LANDING,
          can_expand: true,
          children: [
            createBrowseMedia({
              media_content_id: DAY,
              title: '2026-08-28',
              can_expand: true,
            }),
            createBrowseMedia({
              media_content_id: IMAGES,
              title: 'images',
              can_expand: true,
            }),
          ],
        }),
        [DAY]: createBrowseMedia({
          media_content_id: DAY,
          can_expand: true,
          children: [
            createBrowseMedia({ media_content_id: `${DAY}/one.mp4`, title: 'one.mp4' }),
          ],
        }),
        [IMAGES]: createBrowseMedia({
          media_content_id: IMAGES,
          can_expand: true,
          children: [
            createBrowseMedia({
              media_content_id: `${IMAGES}/2026-08-28.jpg`,
              title: '2026-08-28.jpg',
            }),
          ],
        }),
      };

      vi.mocked(homeAssistantWSRequest).mockImplementation(
        async (_hass, _schema, request) => {
          const mediaContentID: unknown = request.media_content_id;
          return typeof mediaContentID === 'string' ? tree[mediaContentID] : null;
        },
      );

      // An id deeper in the path is where the walk starts, so the components
      // before it are never browsed.
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [
          { ha: { id: LANDING } },
          { ha: { parsers: [{ type: 'thumbnail' }] } },
          { ha: { id: DAY } },
        ],
      };

      const engine = new HAFoldersEngine(templateManager);
      const results = await engine.expandFolder(createHASS(), query);

      expect(results?.map((item) => item.getTitle())).toEqual(['one.mp4']);
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
      const engine = new HAFoldersEngine(templateManager);
      await engine.expandFolder(hass, query);

      expect(homeAssistantWSRequest).toHaveBeenCalledWith(hass, browseMediaSchema, {
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
      const engine = new HAFoldersEngine(templateManager);
      expect(await engine.expandFolder(createHASS(), query)).toBeNull();
    });

    it('should return every matching media item without a cap', async () => {
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

      const engine = new HAFoldersEngine(templateManager);
      const results = await engine.expandFolder(createHASS(), query);

      expect(results?.length).toBe(2);
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

        const engine = new HAFoldersEngine(templateManager);
        const results = await engine.expandFolder(createHASS(), query);
        expect(results?.length).toBe(expectedMatches);
      });
    });

    it('should give media a thumbnail from a sibling image', async () => {
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: { type: 'ha', id: 'test' },
        path: [
          { ha: { id: 'media-source://id' } },
          { ha: { parsers: [{ type: 'thumbnail' }] } },
        ],
      };

      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(
        createBrowseMedia({
          media_content_id: 'media-source://id',
          can_expand: true,
          children: [
            createBrowseMedia({
              media_content_id: 'media-source://id/clip.mp4',
              title: 'clip.mp4',
            }),
            createBrowseMedia({
              media_content_id: 'media-source://id/clip.jpg',
              title: 'clip.jpg',
              media_class: 'image',
            }),
          ],
        }),
      );

      const engine = new HAFoldersEngine(templateManager);
      const results = await engine.expandFolder(createHASS(), query);

      expect(results?.length).toBe(1);

      const item = results?.[0];
      assert(item instanceof ViewMedia);
      expect(item.getContentID()).toBe('media-source://id/clip.mp4');
      expect(item.getThumbnail()).toBe('media-source://id/clip.jpg');
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

      const engine = new HAFoldersEngine(templateManager);
      const query = { folder: { type: 'ha' } } as FolderQuery;
      const resultsTimestamp = new Date('2026-01-02T07:54:30Z');

      expect(engine.areResultsFresh(resultsTimestamp, query)).toBe(true);
    });

    it('should return false for stale results', () => {
      const now = new Date('2026-01-02T07:54:32Z');
      vi.setSystemTime(now);

      const engine = new HAFoldersEngine(templateManager);
      const query = { folder: { type: 'ha' } } as FolderQuery;
      const resultsTimestamp = new Date('2026-01-02T07:53:30Z');

      expect(engine.areResultsFresh(resultsTimestamp, query)).toBe(false);
    });
  });
});
