import { format, getDaysInMonth, subDays } from 'date-fns';
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
import type {
  FolderConfig,
  FolderNavigation,
  Matcher,
} from '../../../../src/config/schema/folders';
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
import { ViewItemClassifier } from '../../../../src/view/item-classifier';
import { createBrowseMedia, createFolder, createHASS } from '../../../test-utils';
import { TestViewMedia } from '../../../view/test-utils';

vi.mock('../../../../src/ha/download');
vi.mock('../../../../src/ha/ws-request');

describe('HAFoldersEngine', () => {
  const templateManager = new TemplateManager();

  const createDefaultQuery = (
    engine: HAFoldersEngine,
    folder: FolderConfig,
  ): FolderQuery => {
    const query = engine.getDefaultQueryParameters(folder);
    assert(query);
    return query;
  };

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

  describe('getMediaSeekTime', () => {
    const start = new Date('2024-01-01T10:00:00');
    const end = new Date('2024-01-01T11:00:00');
    const createMedia = (options?: {
      startTime?: Date | null;
      endTime?: Date | null;
    }): TestViewMedia =>
      new TestViewMedia({
        folder: createFolder(),
        startTime: start,
        endTime: end,
        ...options,
      });

    it('should return the seconds since the start', () => {
      const engine = new HAFoldersEngine(templateManager);

      expect(
        engine.getMediaSeekTime(createMedia(), new Date('2024-01-01T10:30:00')),
      ).toBe(1800);
    });

    it.each([
      ['before the start', new Date('2024-01-01T09:59:59')],
      ['after the end', new Date('2024-01-01T11:00:01')],
    ])('should not seek to a time %s', (_name: string, target: Date) => {
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getMediaSeekTime(createMedia(), target)).toBeNull();
    });

    it.each([
      ['a start', { startTime: null }],
      ['an end', { endTime: null }],
    ])(
      'should not seek without %s',
      (_name: string, options: { startTime?: null; endTime?: null }) => {
        const engine = new HAFoldersEngine(templateManager);

        expect(
          engine.getMediaSeekTime(createMedia(options), new Date('2024-01-01T10:30:00')),
        ).toBeNull();
      },
    );
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
        path: [{}, {}],
      });
    });

    it('should start at the media source root when no path is configured', () => {
      const folder: FolderConfig = { type: 'ha', id: 'test', navigation: 'restricted' };
      const engine = new HAFoldersEngine(templateManager);

      expect(engine.getDefaultQueryParameters(folder)).toEqual({
        source: QuerySource.Folder,
        folder,
        path: [{}, {}],
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
      const engine = new HAFoldersEngine(templateManager);
      const query = createDefaultQuery(
        engine,
        createFolder({ ha: { path: [{ id: 'media-source://id' }] } }),
      );

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

      const results = await engine.expandFolder(createHASS(), query);
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);

      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(1);

      // Expanding the folder again should use the cache.
      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(1);
    });

    it('should expand folder without reading the cache, but still cache the results, when requested', async () => {
      const engine = new HAFoldersEngine(templateManager);
      const query = createDefaultQuery(
        engine,
        createFolder({ ha: { path: [{ id: 'media-source://id' }] } }),
      );

      const browseMedia = createBrowseMedia({
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
      });
      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(browseMedia)
        .mockResolvedValueOnce(browseMedia);

      await engine.expandFolder(createHASS(), query);
      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(1);

      const results = await engine.expandFolder(
        createHASS(),
        query,
        {},
        {
          allowCached: false,
        },
      );
      expect(results?.length).toBe(2);
      expect(results?.[0]).toBeInstanceOf(ViewMedia);
      expect(results?.[1]).toBeInstanceOf(ViewFolder);
      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(2);

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

      const folder = createFolder({
        ha: {
          path: [{ id: LANDING }, { parsers: [{ type: 'thumbnail' }] }],
        },
      });
      const engine = new HAFoldersEngine(templateManager);

      const query: FolderQuery = {
        ...createDefaultQuery(engine, folder),
        path: [
          {},
          { folder: new BrowseMediaViewFolder(folder, [], dayBrowseMedia) },
          {},
        ],
      };

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

      const engine = new HAFoldersEngine(templateManager);
      const query = createDefaultQuery(
        engine,
        createFolder({
          ha: {
            path: [{ id: LANDING }, { parsers: [{ type: 'thumbnail' }] }, { id: DAY }],
          },
        }),
      );

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
        folder: { type: 'ha', id: 'test', navigation: 'restricted' },
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

    it('should not expand without an id to start from', async () => {
      const query: FolderQuery = {
        source: QuerySource.Folder,
        folder: createFolder({ ha: { path: [{}] } }),
        // There's no component in the query with an id to start from.
        path: [{}],
      };
      const engine = new HAFoldersEngine(templateManager);
      expect(await engine.expandFolder(createHASS(), query)).toBeNull();
    });

    it('should return every matching media item without a cap', async () => {
      const engine = new HAFoldersEngine(templateManager);
      const query = createDefaultQuery(
        engine,
        createFolder({ ha: { path: [{ id: 'media-source://id' }] } }),
      );

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
        const engine = new HAFoldersEngine(templateManager);
        const query = createDefaultQuery(
          engine,
          createFolder({
            ha: { path: [{ id: 'media-source://' }, { matchers: [matcher] }, {}] },
          }),
        );

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

        const results = await engine.expandFolder(createHASS(), query);
        expect(results?.length).toBe(expectedMatches);
      });
    });

    it('should give media a thumbnail from a sibling image', async () => {
      const engine = new HAFoldersEngine(templateManager);
      const query = createDefaultQuery(
        engine,
        createFolder({
          ha: {
            path: [{ id: 'media-source://id' }, { parsers: [{ type: 'thumbnail' }] }],
          },
        }),
      );

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

      const results = await engine.expandFolder(createHASS(), query);

      expect(results?.length).toBe(1);

      const item = results?.[0];
      assert(item instanceof ViewMedia);
      expect(item.getContentID()).toBe('media-source://id/clip.mp4');
      expect(item.getThumbnail()).toBe('media-source://id/clip.jpg');
    });
  });

  describe('with a time range', () => {
    const ROOT = 'media-source://recorder';
    const DEVICE = `${ROOT}/device`;

    const createDirectory = (id: string, children: BrowseMedia[] = []): BrowseMedia =>
      createBrowseMedia({
        media_content_id: id,
        title: id.split('/').slice(-1)[0],
        can_expand: true,
        children,
      });

    // Serve a media source from the directories given, with all other
    // directories containing a single recording that crosses midnight. Returns
    // a function that lists, in sorted order, every folder opened inside
    // `DEVICE`, as its path relative to `DEVICE` (e.g. `2026-11-01/11`).
    const mockMediaSource = (
      directories: Record<string, string[]>,
    ): (() => string[]) => {
      vi.mocked(homeAssistantWSRequest).mockImplementation(
        async (_hass, _schema, request) => {
          const id = String(request.media_content_id);
          const children = directories[id]?.map((title) =>
            createDirectory(`${id}/${title}`),
          );
          return createDirectory(
            id,
            children ?? [
              createBrowseMedia({
                media_content_id: `${id}/recording`,
                title: '22:18:51 - 00:50:06',
              }),
            ],
          );
        },
      );

      return () =>
        vi
          .mocked(homeAssistantWSRequest)
          .mock.calls.map(([, , request]) => String(request.media_content_id))
          .filter((id) => id.startsWith(`${DEVICE}/`))
          .map((id) => id.slice(DEVICE.length + 1))
          .sort();
    };

    const mockDays = (days: string[]): (() => string[]) =>
      mockMediaSource({ [ROOT]: ['device'], [DEVICE]: days });

    const createRecorderFolder = (dayMatchers?: Matcher[]): FolderConfig =>
      createFolder({
        ha: {
          path: [
            { id: ROOT },
            {},
            {
              parsers: [{ type: 'date', format: 'yyyy-MM-dd' }],
              ...(dayMatchers && { matchers: dayMatchers }),
            },
            {
              parsers: [
                { type: 'startdate', regexp: '^[0-9:]{8}', format: 'HH:mm:ss' },
                { type: 'enddate', regexp: '[0-9:]{8}$', format: 'HH:mm:ss' },
              ],
            },
          ],
        },
      });

    // 62 days, from 2026-09-12 to 2026-11-12 .
    const days = Array.from({ length: 62 }, (_, i) =>
      format(subDays(new Date('2026-11-12T00:00:00'), i), 'yyyy-MM-dd'),
    );

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-12T12:00:00'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('should open every folder without a time range', async () => {
      const getOpened = mockDays(days);
      const engine = new HAFoldersEngine(templateManager);

      const results = await engine.expandFolder(
        createHASS(),
        createDefaultQuery(engine, createRecorderFolder()),
      );

      expect(getOpened()).toHaveLength(62);
      expect(results).toHaveLength(62);
    });

    it('should open only folders that may contain media in the time range', async () => {
      const getOpened = mockDays(days);
      const engine = new HAFoldersEngine(templateManager);

      const results = await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(engine, createRecorderFolder()),
        start: new Date('2026-10-10T00:00:00'),
        end: new Date('2026-10-10T23:59:59.999'),
      });

      // Includes the prior day, as its media may start within 24 hours before
      // the time range (its recording crosses midnight into it).
      expect(getOpened()).toEqual(['2026-10-09', '2026-10-10']);
      expect(
        results?.map((item) => ViewItemClassifier.isMedia(item) && item.getEndTime()),
      ).toEqual([new Date('2026-10-11T00:50:06'), new Date('2026-10-10T00:50:06')]);
    });

    it('should open only the most recent folder when every folder starts before the time range', async () => {
      const getOpened = mockDays(['2026-11-01', '2026-11-02', '2026-11-03']);
      const engine = new HAFoldersEngine(templateManager);

      await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(engine, createRecorderFolder()),
        start: new Date('2026-11-12T11:00:00'),
      });

      expect(getOpened()).toEqual(['2026-11-03']);
    });

    it('should decide which folders to open within each parent folder separately', async () => {
      const getOpened = mockMediaSource({
        [ROOT]: ['device'],
        [DEVICE]: ['a', 'b'],
        [`${DEVICE}/a`]: ['2026-11-01', '2026-11-02', '2026-11-03'],
        [`${DEVICE}/b`]: ['2026-11-10', '2026-11-11', '2026-11-12'],
      });
      const engine = new HAFoldersEngine(templateManager);

      await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(
          engine,
          createFolder({
            ha: {
              path: [
                { id: DEVICE },
                {},
                { parsers: [{ type: 'date', format: 'yyyy-MM-dd' }] },
                {},
              ],
            },
          }),
        ),
        start: new Date('2026-11-12T11:00:00'),
      });

      expect(getOpened()).toEqual([
        'a',
        'a/2026-11-03',
        'b',
        'b/2026-11-11',
        'b/2026-11-12',
      ]);
    });

    it('should open folders without a date', async () => {
      const getOpened = mockDays(['2026-11-01', '2026-11-02', 'Favorites']);
      const engine = new HAFoldersEngine(templateManager);

      await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(engine, createRecorderFolder()),
        start: new Date('2026-10-01T00:00:00'),
        end: new Date('2026-11-01T12:00:00'),
      });

      expect(getOpened()).toEqual(['2026-11-01', 'Favorites']);
    });

    it('should open folders whose name has no date, even inside a dated folder', async () => {
      const getOpened = mockMediaSource({
        [DEVICE]: ['2026-11-01'],
        [`${DEVICE}/2026-11-01`]: ['10', '11', '12', 'Favorites'],
      });
      const engine = new HAFoldersEngine(templateManager);

      await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(
          engine,
          createFolder({
            ha: {
              path: [
                { id: DEVICE },
                { parsers: [{ type: 'date', format: 'yyyy-MM-dd' }] },
                { parsers: [{ type: 'date', regexp: '^[0-9]+$', format: 'HH' }] },
                {},
              ],
            },
          }),
        ),
        start: new Date('2026-11-01T12:15:00'),
        end: new Date('2026-11-01T12:45:00'),
      });

      // '10' may hold media running for up to 24 hours, so into the time range.
      // 'Favorites' inherits 2026-11-01T00:00:00 from its parent.
      expect(getOpened()).toEqual([
        '2026-11-01',
        '2026-11-01/10',
        '2026-11-01/11',
        '2026-11-01/12',
        '2026-11-01/Favorites',
      ]);
    });

    it("should treat a folder named only by its day as that day of the parent folder's month", async () => {
      const getOpened = mockMediaSource({
        [DEVICE]: ['10'],
        [`${DEVICE}/10`]: ['29', '30', '31'],
      });
      const engine = new HAFoldersEngine(templateManager);

      // The clock is in November, which has no 31st.
      await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(
          engine,
          createFolder({
            ha: {
              path: [
                { id: DEVICE },
                { parsers: [{ type: 'date', format: 'MM' }] },
                { parsers: [{ type: 'date', format: 'dd' }] },
                {},
              ],
            },
          }),
        ),
        start: new Date('2026-10-29T10:00:00'),
        end: new Date('2026-10-29T11:00:00'),
      });

      expect(getOpened()).toEqual(['10', '10/29']);
    });

    it("should open the previous day's folder when it is in a different month and year", async () => {
      const months: Record<string, string[]> = {
        '2025': ['10', '11', '12'],
        '2026': ['01', '02'],
      };
      const directories: Record<string, string[]> = {
        [DEVICE]: Object.keys(months),
      };
      for (const [year, yearMonths] of Object.entries(months)) {
        directories[`${DEVICE}/${year}`] = yearMonths;
        for (const month of yearMonths) {
          directories[`${DEVICE}/${year}/${month}`] = Array.from(
            { length: getDaysInMonth(new Date(Number(year), Number(month) - 1)) },
            (_, index) => String(index + 1).padStart(2, '0'),
          );
        }
      }
      const getOpened = mockMediaSource(directories);
      const engine = new HAFoldersEngine(templateManager);

      const results = await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(
          engine,
          createFolder({
            ha: {
              path: [
                { id: DEVICE },
                { parsers: [{ type: 'date', format: 'yyyy' }] },
                { parsers: [{ type: 'date', format: 'MM' }] },
                { parsers: [{ type: 'date', format: 'dd' }] },
                {
                  parsers: [
                    { type: 'startdate', regexp: '^[0-9:]{8}', format: 'HH:mm:ss' },
                    { type: 'enddate', regexp: '[0-9:]{8}$', format: 'HH:mm:ss' },
                  ],
                },
              ],
            },
          }),
        ),
        start: new Date('2026-01-01T00:10:00'),
        end: new Date('2026-01-01T00:40:00'),
      });

      // Only Dec 31 and Jan 1 may hold media starting within 24 hours before
      // the time range, and Dec 31's recording crosses midnight into it.
      expect(getOpened()).toEqual([
        '2025',
        '2025/12',
        '2025/12/31',
        '2026',
        '2026/01',
        '2026/01/01',
      ]);
      expect(
        results?.map((item) => ViewItemClassifier.isMedia(item) && item.getEndTime()),
      ).toEqual([new Date('2026-01-01T00:50:06')]);
    });

    it('should not open folders that the matchers exclude', async () => {
      const getOpened = mockDays(days);
      const engine = new HAFoldersEngine(templateManager);

      await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(
          engine,
          createRecorderFolder([{ type: 'date', since: { days: 2 } }]),
        ),
        start: new Date('2026-11-01T00:00:00'),
      });

      expect(getOpened()).toEqual(['2026-11-11', '2026-11-12']);
    });

    it('should not open a folder again for an overlapping time range', async () => {
      const getOpened = mockDays(days);
      const engine = new HAFoldersEngine(templateManager);
      const query = createDefaultQuery(engine, createRecorderFolder());

      await engine.expandFolder(createHASS(), {
        ...query,
        start: new Date('2026-10-10T00:00:00'),
        end: new Date('2026-10-11T12:00:00'),
      });
      await engine.expandFolder(createHASS(), {
        ...query,
        start: new Date('2026-10-09T00:00:00'),
        end: new Date('2026-10-10T12:00:00'),
      });

      expect(getOpened()).toEqual([
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ]);
    });

    it('should not return folders for a time range, even one dated within it', async () => {
      mockDays(days);
      const engine = new HAFoldersEngine(templateManager);

      const results = await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(
          engine,
          createFolder({
            ha: {
              path: [
                { id: DEVICE },
                { parsers: [{ type: 'date', format: 'yyyy-MM-dd' }] },
              ],
            },
          }),
        ),
        start: new Date('2026-10-10T00:00:00'),
        end: new Date('2026-10-10T23:59:59.999'),
      });

      expect(results).toEqual([]);
    });

    it('should not return media outside the time range or without a date', async () => {
      const day = `${DEVICE}/2026-11-12`;
      const undated = `${DEVICE}/Favorites`;
      const createClip = (parent: string, title: string): BrowseMedia =>
        createBrowseMedia({ media_content_id: `${parent}/${title}`, title });

      const directories: Record<string, BrowseMedia[]> = {
        [ROOT]: [createDirectory(DEVICE)],
        [DEVICE]: [createDirectory(day), createDirectory(undated)],
        [day]: [
          createClip(day, '08:00:00 - 08:10:00'),
          createClip(day, '10:55:00 - 11:05:00'),
          createClip(day, '11:30:00.mp4'),
          createClip(day, '12:30:00 - 12:40:00'),
        ],
        [undated]: [createClip(undated, 'Doorbell')],
      };
      vi.mocked(homeAssistantWSRequest).mockImplementation(
        async (_hass, _schema, request) => {
          const id = String(request.media_content_id);
          return createDirectory(id, directories[id]);
        },
      );
      const engine = new HAFoldersEngine(templateManager);

      const results = await engine.expandFolder(createHASS(), {
        ...createDefaultQuery(engine, createRecorderFolder()),
        start: new Date('2026-11-12T11:00:00'),
        end: new Date('2026-11-12T12:00:00'),
      });

      expect(
        results?.map((item) => ViewItemClassifier.isMedia(item) && item.getContentID()),
      ).toEqual([`${day}/10:55:00 - 11:05:00`, `${day}/11:30:00.mp4`]);
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

  describe('should navigate', () => {
    const ROOT = 'media-source://';
    const KITCHEN = `${ROOT}Kitchen`;
    const GARAGE = `${ROOT}Garage`;

    const createKitchenFolder = (navigation?: FolderNavigation): FolderConfig =>
      createFolder({
        ...(navigation && { navigation }),
        ha: { path: [{ id: KITCHEN }, { parsers: [{ type: 'thumbnail' }] }] },
      });

    const createRoom = (id: string, title: string): BrowseMedia =>
      createBrowseMedia({
        media_content_id: id,
        title,
        can_expand: true,
        children: [
          createBrowseMedia({
            media_content_id: `${id}/2026-08-28`,
            title: '2026-08-28',
            can_expand: true,
          }),
          createBrowseMedia({
            media_content_id: `${id}/2026-08-28.jpg`,
            title: '2026-08-28.jpg',
            media_class: 'image',
          }),
        ],
      });

    const mockTree = (): void => {
      const kitchen = createRoom(KITCHEN, 'Kitchen');
      const garage = createRoom(GARAGE, 'Garage');
      const tree: Record<string, BrowseMedia> = {
        [ROOT]: createBrowseMedia({
          media_content_id: ROOT,
          can_expand: true,
          children: [kitchen, garage],
        }),
        [KITCHEN]: kitchen,
        [GARAGE]: garage,
      };

      vi.mocked(homeAssistantWSRequest).mockImplementation(
        async (_hass, _schema, request) => {
          const mediaContentID: unknown = request.media_content_id;
          return typeof mediaContentID === 'string' ? tree[mediaContentID] : null;
        },
      );
    };

    describe('getUpQuery', () => {
      it('should not go above the configured folder when restricted', () => {
        const engine = new HAFoldersEngine(templateManager);
        const folder = createKitchenFolder();

        expect(engine.getUpQuery(createDefaultQuery(engine, folder))).toBeNull();
      });

      it('should return to the configured folder after navigating into it', () => {
        const engine = new HAFoldersEngine(templateManager);
        const folder = createKitchenFolder();
        const query = createDefaultQuery(engine, folder);
        const item = new ViewFolder(folder, query.path);
        const downQuery = engine.getDownQuery(item);
        assert(downQuery);

        expect(engine.getUpQuery(downQuery)).toEqual(query);
      });

      it('should remove any time range when navigating up', () => {
        const engine = new HAFoldersEngine(templateManager);
        const query = createDefaultQuery(engine, createKitchenFolder('unrestricted'));

        expect(
          engine.getUpQuery({
            ...query,
            start: new Date('2026-08-28T00:00:00'),
            end: new Date('2026-08-29T00:00:00'),
          }),
        ).toEqual({ ...query, path: [{}, {}] });
      });

      it('should go above the configured folder when unrestricted', () => {
        const engine = new HAFoldersEngine(templateManager);
        const query = createDefaultQuery(engine, createKitchenFolder('unrestricted'));

        expect(engine.getUpQuery(query)).toEqual({ ...query, path: [{}, {}] });
      });

      it('should not go above the outermost configured level', () => {
        const engine = new HAFoldersEngine(templateManager);
        const folder = createKitchenFolder('unrestricted');
        const upQuery = engine.getUpQuery(createDefaultQuery(engine, folder));
        assert(upQuery);

        expect(engine.getUpQuery(upQuery)).toBeNull();
      });

      it('should not go above a folder configured at the media source root', () => {
        const engine = new HAFoldersEngine(templateManager);
        const query = createDefaultQuery(
          engine,
          createFolder({ navigation: 'unrestricted' }),
        );

        expect(engine.getUpQuery(query)).toBeNull();
      });
    });

    describe('getDownQuery', () => {
      it('should name the clicked folder and add a level for its contents', () => {
        const engine = new HAFoldersEngine(templateManager);
        const folder = createKitchenFolder();
        const item = new ViewFolder(folder, createDefaultQuery(engine, folder).path);

        expect(engine.getDownQuery(item)).toEqual({
          source: QuerySource.Folder,
          folder,
          path: [{}, {}, { folder: item }, {}],
        });
      });
    });

    describe('above the configured folder', () => {
      it('should show the contents of the level above', async () => {
        mockTree();
        const engine = new HAFoldersEngine(templateManager);
        const folder = createKitchenFolder('unrestricted');
        const upQuery = engine.getUpQuery(createDefaultQuery(engine, folder));
        assert(upQuery);

        const results = await engine.expandFolder(createHASS(), upQuery);

        expect(results?.map((item) => item.getTitle())).toEqual(['Kitchen', 'Garage']);
      });

      it('should apply configured parsers to a folder navigated into', async () => {
        mockTree();
        const engine = new HAFoldersEngine(templateManager);
        const folder = createKitchenFolder('unrestricted');
        const garage = new BrowseMediaViewFolder(
          folder,
          [],
          createRoom(GARAGE, 'Garage'),
        );

        const results = await engine.expandFolder(createHASS(), {
          ...createDefaultQuery(engine, folder),
          path: [{}, { folder: garage }, {}],
        });

        // The image became the thumbnail of the folder so it is not shown in
        // its own right.
        expect(results?.map((item) => item.getTitle())).toEqual(['2026-08-28']);
        expect(results?.[0].getThumbnail()).toBe(`${GARAGE}/2026-08-28.jpg`);
      });

      it('should ignore a configured id below a folder navigated into', async () => {
        mockTree();
        const engine = new HAFoldersEngine(templateManager);

        const folder = createFolder({
          navigation: 'unrestricted',
          ha: {
            path: [{ id: KITCHEN }, { id: `${KITCHEN}/2026-08-28` }],
          },
        });

        // The media source root is 2 levels up, and lists Kitchen & Garage.
        const kitchenQuery = engine.getUpQuery(createDefaultQuery(engine, folder));
        assert(kitchenQuery);
        const rootQuery = engine.getUpQuery(kitchenQuery);
        assert(rootQuery);

        const garage = new BrowseMediaViewFolder(
          folder,
          rootQuery.path,
          createRoom(GARAGE, 'Garage'),
        );

        const results = await engine.expandFolder(
          createHASS(),
          engine.getDownQuery(garage),
        );

        expect(results?.map((item) => item.getID())).toEqual([
          `${GARAGE}/2026-08-28`,
          `${GARAGE}/2026-08-28.jpg`,
        ]);
      });

      it('should carry parsed metadata downwards during navigation', async () => {
        const MONTH = `${ROOT}2026-08`;
        const month = createBrowseMedia({
          media_content_id: MONTH,
          title: '2026-08',
          can_expand: true,
          children: [
            createBrowseMedia({ media_content_id: `${MONTH}/28`, title: '28' }),
          ],
        });
        const tree: Record<string, BrowseMedia> = {
          [ROOT]: createBrowseMedia({
            media_content_id: ROOT,
            can_expand: true,
            children: [month],
          }),
          [MONTH]: month,
        };
        vi.mocked(homeAssistantWSRequest).mockImplementation(
          async (_hass, _schema, request) => {
            const mediaContentID: unknown = request.media_content_id;
            return typeof mediaContentID === 'string' ? tree[mediaContentID] : null;
          },
        );

        const engine = new HAFoldersEngine(templateManager);
        const folder = createFolder({
          navigation: 'unrestricted',
          ha: {
            path: [{ id: ROOT }, { parsers: [{ type: 'date', format: 'yyyy-MM' }] }],
          },
        });

        const listing = await engine.expandFolder(
          createHASS(),
          createDefaultQuery(engine, folder),
        );
        const monthItem = listing?.[0];
        assert(monthItem instanceof BrowseMediaViewFolder);

        const results = await engine.expandFolder(
          createHASS(),
          engine.getDownQuery(monthItem),
        );

        // No level is configured below the month, so the day can only be dated
        // by inheriting the parsed date from above.
        const day = results?.[0];
        assert(day instanceof ViewMedia);
        expect(day.getStartTime()).toEqual(new Date(2026, 7, 1));
      });

      it('should keep filtering with configured matchers', async () => {
        mockTree();
        const engine = new HAFoldersEngine(templateManager);
        const folder = createFolder({
          navigation: 'unrestricted',
          ha: {
            path: [
              { id: ROOT },
              { matchers: [{ type: 'title', title: 'Kitchen' }] },
              { parsers: [{ type: 'thumbnail' }] },
            ],
          },
        });
        const upQuery = engine.getUpQuery(createDefaultQuery(engine, folder));
        assert(upQuery);

        const results = await engine.expandFolder(createHASS(), upQuery);

        expect(results?.map((item) => item.getTitle())).toEqual(['Kitchen']);
      });
    });
  });
});
