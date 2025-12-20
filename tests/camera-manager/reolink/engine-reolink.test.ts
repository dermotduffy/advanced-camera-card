import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  ReolinkCameraManagerEngine,
  ReolinkQueryResultsClassifier,
} from '../../../src/camera-manager/reolink/engine-reolink';
import { ReolinkEventQueryResults } from '../../../src/camera-manager/reolink/types';
import { CameraManagerStore } from '../../../src/camera-manager/store';
import {
  CameraManagerRequestCache,
  Engine,
  EventQuery,
  QueryResultsType,
  QueryReturnType,
  QueryType,
} from '../../../src/camera-manager/types';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { BrowseMedia, browseMediaSchema } from '../../../src/ha/browse-media/types';
import { BrowseMediaWalker } from '../../../src/ha/browse-media/walker';
import { DeviceRegistryManager } from '../../../src/ha/registry/device';
import { EntityRegistryManager } from '../../../src/ha/registry/entity/types';
import { ResolvedMediaCache } from '../../../src/ha/resolved-media';
import { homeAssistantWSRequest } from '../../../src/ha/ws-request';
import { EntityRegistryManagerMock } from '../../ha/registry/entity/mock';
import {
  createInitializedCamera,
  createCameraConfig,
  createHASS,
  createRegistryEntity,
  createStore,
} from '../../test-utils';

vi.mock('../../../src/ha/ws-request');

const TEST_CAMERAS: BrowseMedia = {
  title: 'Reolink',
  media_class: 'channel',
  media_content_type: 'playlist',
  media_content_id: 'media-source://reolink',
  children_media_class: 'directory',
  can_play: false,
  can_expand: true,
  thumbnail: null,
  children: [
    {
      title: 'Back Yard',
      media_class: 'directory',
      media_content_type: 'playlist',
      media_content_id: 'media-source://reolink/CAM|01J8XHYTNH77WE3C654K03KX1F|0',
      children_media_class: null,
      can_play: false,
      can_expand: true,
      thumbnail: null,
    },
  ],
};

const TEST_DIRECTORIES: BrowseMedia = {
  title: 'Back Yard Low res.',
  media_class: 'channel',
  media_content_type: 'playlist',
  media_content_id: 'media-source://reolink/DAYS|01J8XHYTNH77WE3C654K03KX1F|0|sub',
  children_media_class: 'directory',
  can_play: false,
  can_expand: true,
  thumbnail: null,
  children: [
    {
      title: '2024/11/4',
      media_class: 'directory',
      media_content_type: 'playlist',
      media_content_id:
        'media-source://reolink/DAY|01J8XHYTNH77WE3C654K03KX1F|0|sub|2024|11|4',
      children_media_class: null,
      can_play: false,
      can_expand: true,
      thumbnail: null,
    },
    {
      title: '2024/11/5',
      media_class: 'directory',
      media_content_type: 'playlist',
      media_content_id:
        'media-source://reolink/DAY|01J8XHYTNH77WE3C654K03KX1F|0|sub|2024|11|5',
      children_media_class: null,
      can_play: false,
      can_expand: true,
      thumbnail: null,
    },
    {
      title: '2024/11/6',
      media_class: 'directory',
      media_content_type: 'playlist',
      media_content_id:
        'media-source://reolink/DAY|01J8XHYTNH77WE3C654K03KX1F|0|sub|2024|11|6',
      children_media_class: null,
      can_play: false,
      can_expand: true,
      thumbnail: null,
    },
  ],
};

const TEST_FILES: BrowseMedia = {
  title: 'Back Yard Low res. 2024/11/4',
  media_class: 'channel',
  media_content_type: 'playlist',
  media_content_id: 'media-source://reolink/FILES|01J8XHYTNH77WE3C654K03KX1F|0|sub',
  children_media_class: 'video',
  can_play: false,
  can_expand: true,
  thumbnail: null,
  children: [
    {
      title: '21:23:53 0:00:34',
      media_class: 'video',
      media_content_type: 'video',
      media_content_id:
        'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
      children_media_class: null,
      can_play: true,
      can_expand: false,
      thumbnail: null,
    },
    {
      title: '21:29:05 0:00:41',
      media_class: 'video',
      media_content_type: 'video',
      media_content_id:
        'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052905_211_S.mp4',
      children_media_class: null,
      can_play: true,
      can_expand: false,
      thumbnail: null,
    },
    {
      title: '21:35:05 0:00:41 Zebra Person Vehicle',
      media_class: 'video',
      media_content_type: 'video',
      media_content_id:
        'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052905_211_S.mp4',
      children_media_class: null,
      can_play: true,
      can_expand: false,
      thumbnail: null,
    },
    {
      title: '21:37:00',
      media_class: 'video',
      media_content_type: 'video',
      media_content_id:
        'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052905_211_S.mp4',
      children_media_class: null,
      can_play: true,
      can_expand: false,
      thumbnail: null,
    },
    {
      title: '22:04:49 0:00:35',
      media_class: 'video',
      media_content_type: 'video',
      media_content_id:
        'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_060449_211_S.mp4',
      children_media_class: null,
      can_play: true,
      can_expand: false,
      thumbnail: null,
    },
  ],
};

const createEngine = (options?: {
  browseMediaManager?: BrowseMediaWalker;
  entityRegistryManager?: EntityRegistryManager;
}): ReolinkCameraManagerEngine => {
  return new ReolinkCameraManagerEngine(
    options?.entityRegistryManager ?? new EntityRegistryManagerMock(),
    mock<DeviceRegistryManager>(),
    mock<StateWatcher>(),
    options?.browseMediaManager ?? new BrowseMediaWalker(),
    new ResolvedMediaCache(),
    new CameraManagerRequestCache(),
  );
};

const cameraEntity = createRegistryEntity({
  entity_id: 'camera.office',
  unique_id: '85270002TS7D4RUP_0_main',
  platform: 'reolink',
  config_entry_id: '01J8XHYTNH77WE3C654K03KX1F',
});

const createPopulatedEngine = (): ReolinkCameraManagerEngine => {
  const entityRegistryManager = new EntityRegistryManagerMock([cameraEntity]);
  return createEngine({ entityRegistryManager });
};

const createStoreWithReolinkCamera = async (
  engine: ReolinkCameraManagerEngine,
): Promise<CameraManagerStore> => {
  const store = new CameraManagerStore();
  const camera = await engine.createCamera(
    createHASS(),
    createCameraConfig({ camera_entity: 'camera.office', id: 'office' }),
  );
  store.addCamera(camera);
  return store;
};

describe('ReolinkQueryResultsClassifier', () => {
  it('should correctly identify matching results', () => {
    expect(
      ReolinkQueryResultsClassifier.isReolinkEventQueryResults({
        type: QueryResultsType.Event,
        engine: Engine.Reolink,
      }),
    ).toBeTruthy();
  });

  it('should correctly identify non-matching results', () => {
    expect(
      ReolinkQueryResultsClassifier.isReolinkEventQueryResults({
        type: QueryResultsType.Event,
        engine: Engine.MotionEye,
      }),
    ).toBeFalsy();
  });
});

describe('ReolinkCameraManagerEngine', () => {
  it('should get correct engine type', () => {
    const engine = createEngine();
    expect(engine.getEngineType()).toBe('reolink');
  });

  it('should create camera', async () => {
    const engine = createPopulatedEngine();
    const config = createCameraConfig({
      camera_entity: 'camera.office',
      unique_id: 'office',
    });

    const camera = await engine.createCamera(createHASS(), config);

    expect(camera.getConfig()).toBe(config);
    expect(camera.getEngine()).toBe(engine);
    expect(camera.getCapabilities()?.getRawCapabilities()).toEqual({
      '2-way-audio': false,
      clips: true,
      'remote-control-entity': true,
      live: true,
      menu: true,
      substream: true,
      trigger: true,
    });
  });

  it('should get camera metadata', () => {
    const cameraConfig = createCameraConfig({
      title: 'Office',
      camera_entity: 'camera.office',
      icon: 'mdi:camera',
    });
    const engine = createEngine();
    expect(engine.getCameraMetadata(createHASS(), cameraConfig)).toEqual({
      engineIcon: 'reolink',
      icon: {
        icon: 'mdi:camera',
        entity: 'camera.office',
        fallback: 'mdi:video',
      },
      title: 'Office',
    });
  });

  describe('should get camera endpoints', () => {
    it('should return ui endpoint', async () => {
      const engine = createPopulatedEngine();
      const camera = await engine.createCamera(
        createHASS(),
        createCameraConfig({
          camera_entity: 'camera.office',
          reolink: {
            url: 'http://path-to-reolink',
          },
        }),
      );

      expect(camera.getEndpoints()).toEqual(
        expect.objectContaining({
          ui: { endpoint: 'http://path-to-reolink' },
        }),
      );
    });

    it('should return go2rtc endpoint', async () => {
      const engine = createPopulatedEngine();
      const camera = await engine.createCamera(
        createHASS(),
        createCameraConfig({
          camera_entity: 'camera.office',
          go2rtc: {
            url: 'http://path-to-go2rtc',
            stream: 'stream',
          },
        }),
      );

      expect(camera.getEndpoints()).toEqual(
        expect.objectContaining({
          go2rtc: { endpoint: 'http://path-to-go2rtc/api/ws?src=stream', sign: false },
        }),
      );
    });
  });

  describe('should get events', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('should get no event for unsupported features', () => {
      it.each([
        ['with favorite', { favorite: true }],
        ['with tags', { tags: new Set(['gate']) }],
        ['with what', { what: new Set(['car']) }],
        ['with where', { where: new Set(['office']) }],
        ['with hasSnapshot', { hasSnapshot: true }],
      ])('%s', async (_name: string, query: Partial<EventQuery>) => {
        const engine = createEngine();
        expect(
          await engine.getEvents(createHASS(), createStore(), {
            ...query,
            cameraIDs: new Set(['office']),
            type: QueryType.Event,
          }),
        ).toBeNull();
      });
    });

    it('should get events successfully without cache', async () => {
      const engine = createPopulatedEngine();
      const store = await createStoreWithReolinkCamera(engine);

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(TEST_CAMERAS)
        .mockResolvedValueOnce(TEST_DIRECTORIES)
        .mockResolvedValueOnce(TEST_FILES);

      const events = await engine.getEvents(
        createHASS(),
        store,
        {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        },
        {
          useCache: false,
        },
      );

      expect(events).toEqual(
        new Map([
          [
            {
              cameraIDs: new Set(['office']),
              end: new Date('2024-11-04T22:00:00'),
              start: new Date('2024-11-04T21:00:00'),
              type: 'event-query',
            },
            {
              browseMedia: [
                {
                  _metadata: {
                    cameraID: 'office',
                    // Date parsed from directory '2024/11/4' + time '21:37:00' in local time
                    startDate: new Date(2024, 10, 4, 21, 37, 0),
                    endDate: new Date(2024, 10, 4, 21, 37, 0),
                  },
                  can_expand: false,
                  can_play: true,
                  children_media_class: null,
                  media_class: 'video',
                  media_content_id:
                    'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052905_211_S.mp4',
                  media_content_type: 'video',
                  thumbnail: null,
                  title: '21:37:00',
                },
                {
                  _metadata: {
                    cameraID: 'office',
                    // Date parsed from directory '2024/11/4' + time '21:35:05' with duration in local time
                    endDate: new Date(2024, 10, 4, 21, 35, 46),
                    startDate: new Date(2024, 10, 4, 21, 35, 5),
                    what: ['person', 'vehicle', 'zebra'],
                  },
                  can_expand: false,
                  can_play: true,
                  children_media_class: null,
                  media_class: 'video',
                  media_content_id:
                    'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052905_211_S.mp4',
                  media_content_type: 'video',
                  thumbnail: null,
                  title: '21:35:05 0:00:41 Zebra Person Vehicle',
                },
                {
                  _metadata: {
                    cameraID: 'office',
                    // Date parsed from directory '2024/11/4' + time '21:29:05' with duration in local time
                    endDate: new Date(2024, 10, 4, 21, 29, 46),
                    startDate: new Date(2024, 10, 4, 21, 29, 5),
                  },
                  can_expand: false,
                  can_play: true,
                  children_media_class: null,
                  media_class: 'video',
                  media_content_id:
                    'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052905_211_S.mp4',
                  media_content_type: 'video',
                  thumbnail: null,
                  title: '21:29:05 0:00:41',
                },
                {
                  _metadata: {
                    cameraID: 'office',
                    // Date parsed from directory '2024/11/4' + time '21:23:53' with duration in local time
                    endDate: new Date(2024, 10, 4, 21, 24, 27),
                    startDate: new Date(2024, 10, 4, 21, 23, 53),
                  },
                  can_expand: false,
                  can_play: true,
                  children_media_class: null,
                  media_class: 'video',
                  media_content_id:
                    'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
                  media_content_type: 'video',
                  thumbnail: null,
                  title: '21:23:53 0:00:34',
                },
              ],
              engine: 'reolink',
              type: 'event-results',
            },
          ],
        ]),
      );
    });

    it('should cache event requests', async () => {
      const engine = createPopulatedEngine();
      const store = await createStoreWithReolinkCamera(engine);

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(TEST_CAMERAS)
        .mockResolvedValueOnce(TEST_DIRECTORIES)
        .mockResolvedValueOnce(TEST_FILES);

      for (let i = 0; i < 10; i++) {
        await engine.getEvents(
          createHASS(),
          store,
          {
            type: QueryType.Event,
            cameraIDs: new Set(['office']),
            start: new Date('2024-11-04T21:00:00'),
            end: new Date('2024-11-04T22:00:00'),
          },
          {
            useCache: true,
          },
        );
      }

      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(3);
    });

    it('should request high resolution if configured', async () => {
      const engine = createPopulatedEngine();
      const camera = await engine.createCamera(
        createHASS(),
        createCameraConfig({
          camera_entity: 'camera.office',
          id: 'office',
          reolink: {
            media_resolution: 'high',
          },
        }),
      );

      const store = new CameraManagerStore();
      store.addCamera(camera);

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(TEST_CAMERAS)
        .mockResolvedValueOnce(TEST_DIRECTORIES)
        .mockResolvedValueOnce(TEST_FILES);

      const hass = createHASS();
      await engine.getEvents(hass, store, {
        type: QueryType.Event,
        cameraIDs: new Set(['office']),
        start: new Date('2024-11-04T21:00:00'),
        end: new Date('2024-11-04T22:00:00'),
      });

      expect(homeAssistantWSRequest).toHaveBeenCalledWith(
        hass,
        browseMediaSchema,
        expect.objectContaining({
          media_content_id:
            // Media source request will refer to 'main' not 'sub'.
            'media-source://reolink/RES|01J8XHYTNH77WE3C654K03KX1F|0|main',
        }),
      );
    });

    describe('should ignore malformed directories', () => {
      it('malformed directory title', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest)
          .mockResolvedValueOnce(TEST_CAMERAS)
          .mockResolvedValueOnce({
            title: 'Back Yard Low res.',
            media_class: 'channel',
            media_content_type: 'playlist',
            media_content_id:
              'media-source://reolink/DAYS|01J8XHYTNH77WE3C654K03KX1F|0|sub',
            children_media_class: 'directory',
            can_play: false,
            can_expand: true,
            thumbnail: null,
            children: [
              {
                // Malformed date.
                title: '__MALFORMED__',
                media_class: 'directory',
                media_content_type: 'playlist',
                media_content_id:
                  'media-source://reolink/DAY|01J8XHYTNH77WE3C654K03KX1F|0|sub|2024|11|4',
                children_media_class: null,
                can_play: false,
                can_expand: true,
                thumbnail: null,
              },
            ],
          });

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });
    });

    describe('should ignore invalid cameras', () => {
      it('camera without a config entry id', async () => {
        const entity = createRegistryEntity({
          entity_id: 'camera.office',
          unique_id: '85270002TS7D4RUP_0_main',
          platform: 'reolink',

          // Cannot fetch events without a config_entry_id.
          config_entry_id: null,
        });
        const entityRegistryManager = new EntityRegistryManagerMock([entity]);

        const engine = createEngine({ entityRegistryManager });
        const store = await createStoreWithReolinkCamera(engine);

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });

      it('should reject requests for non-reolink cameras', async () => {
        const engine = createPopulatedEngine();

        const store = new CameraManagerStore();
        store.addCamera(
          await createInitializedCamera(createCameraConfig({ id: 'office' }), engine),
        );

        const hass = createHASS();
        const events = await engine.getEvents(hass, store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });

      it('should ignore no cameras', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce({
          title: 'Reolink',
          media_class: 'channel',
          media_content_type: 'playlist',
          media_content_id: 'media-source://reolink',
          children_media_class: 'directory',
          can_play: false,
          can_expand: true,
          thumbnail: null,
          children: [
            // No cameras.
          ],
        });

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });

      it('should ignore malformed camera', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce({
          title: 'Reolink',
          media_class: 'channel',
          media_content_type: 'playlist',
          media_content_id: 'media-source://reolink',
          children_media_class: 'directory',
          can_play: false,
          can_expand: true,
          thumbnail: null,
          children: [
            {
              title: 'Back Yard',
              media_class: 'directory',
              media_content_type: 'playlist',
              media_content_id: 'media-source://reolink/__MALFORMED__',
              children_media_class: null,
              can_play: false,
              can_expand: true,
              thumbnail: null,
            },
          ],
        });

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });
    });

    describe('should ignore malformed media', () => {
      it('malformed file title', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest)
          .mockResolvedValueOnce(TEST_CAMERAS)
          .mockResolvedValueOnce(TEST_DIRECTORIES)
          .mockResolvedValueOnce({
            title: 'Back Yard Low res. 2024/11/4',
            media_class: 'channel',
            media_content_type: 'playlist',
            media_content_id:
              'media-source://reolink/FILES|01J8XHYTNH77WE3C654K03KX1F|0|sub',
            children_media_class: 'video',
            can_play: false,
            can_expand: true,
            thumbnail: null,
            children: [
              {
                // Title has invalid title (should be timestamp).
                title: 'AA:BB:CC',
                media_class: 'video',
                media_content_type: 'video',
                media_content_id:
                  'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
                children_media_class: null,
                can_play: true,
                can_expand: false,
                thumbnail: null,
              },
            ],
          });

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });

      it('malformed start time', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest)
          .mockResolvedValueOnce(TEST_CAMERAS)
          .mockResolvedValueOnce(TEST_DIRECTORIES)
          .mockResolvedValueOnce({
            title: 'Back Yard Low res. 2024/11/4',
            media_class: 'channel',
            media_content_type: 'playlist',
            media_content_id:
              'media-source://reolink/FILES|01J8XHYTNH77WE3C654K03KX1F|0|sub',
            children_media_class: 'video',
            can_play: false,
            can_expand: true,
            thumbnail: null,
            children: [
              {
                // Invalid hour.
                title: '29:23:53 0:00:34',
                media_class: 'video',
                media_content_type: 'video',
                media_content_id:
                  'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
                children_media_class: null,
                can_play: true,
                can_expand: false,
                thumbnail: null,
              },
            ],
          });

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });

      it('malformed duration', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest)
          .mockResolvedValueOnce(TEST_CAMERAS)
          .mockResolvedValueOnce(TEST_DIRECTORIES)
          .mockResolvedValueOnce({
            title: 'Back Yard Low res. 2024/11/4',
            media_class: 'channel',
            media_content_type: 'playlist',
            media_content_id:
              'media-source://reolink/FILES|01J8XHYTNH77WE3C654K03KX1F|0|sub',
            children_media_class: 'video',
            can_play: false,
            can_expand: true,
            thumbnail: null,
            children: [
              {
                // Invalid duration.
                title: '21:23:53 INVALID_DURATION',
                media_class: 'video',
                media_content_type: 'video',
                media_content_id:
                  'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
                children_media_class: null,
                can_play: true,
                can_expand: false,
                thumbnail: null,
              },
            ],
          });

        const events = await engine.getEvents(createHASS(), store, {
          type: QueryType.Event,
          cameraIDs: new Set(['office']),
          start: new Date('2024-11-04T21:00:00'),
          end: new Date('2024-11-04T22:00:00'),
        });

        expect(events).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                end: new Date('2024-11-04T22:00:00'),
                start: new Date('2024-11-04T21:00:00'),
                type: 'event-query',
              },
              {
                browseMedia: [
                  {
                    _metadata: {
                      cameraID: 'office',
                      // End time and start time will match.
                      endDate: new Date('2024-11-04T21:23:53'),
                      startDate: new Date('2024-11-04T21:23:53'),
                    },
                    can_expand: false,
                    can_play: true,
                    children_media_class: null,
                    media_class: 'video',
                    media_content_id:
                      'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
                    media_content_type: 'video',
                    thumbnail: null,
                    title: '21:23:53 INVALID_DURATION',
                  },
                ],
                engine: 'reolink',
                type: 'event-results',
              },
            ],
          ]),
        );
      });
    });
  });

  describe('should generate media from events', () => {
    it('should generate media successfully', () => {
      const query: EventQuery = {
        type: QueryType.Event,
        cameraIDs: new Set(['office']),
        start: new Date('2024-11-04T21:00:00'),
        end: new Date('2024-11-04T22:00:00'),
      };

      const results: ReolinkEventQueryResults = {
        browseMedia: [
          {
            _metadata: {
              cameraID: 'office',
              endDate: new Date('2024-11-04T22:00:00'),
              startDate: new Date('2024-11-04T21:00:00'),
            },
            can_expand: false,
            can_play: true,
            children_media_class: null,
            media_class: 'video',
            media_content_id:
              'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
            media_content_type: 'video',
            thumbnail: null,
            title: '21:23:53 1:00:00',
          },
        ],
        engine: Engine.Reolink,
        type: QueryResultsType.Event,
      };

      const store = new CameraManagerStore();
      const engine = createEngine();
      const media = engine.generateMediaFromEvents(createHASS(), store, query, results);
      expect(media?.length).toBe(1);
      expect(media?.[0].getCameraID()).toBe('office');
      expect(media?.[0].getStartTime()).toEqual(new Date('2024-11-04T21:00:00'));
      expect(media?.[0].getEndTime()).toEqual(new Date('2024-11-04T22:00:00'));
      expect(media?.[0].getVideoContentType()).toBe('mp4');
      expect(media?.[0].getID()).toBe('office/2024-11-04 21:00:00');
      expect(media?.[0].getContentID()).toBe(
        'media-source://reolink/FILE|01J8XHYTNH77WE3C654K03KX1F|0|sub|Rec_20241105_052353_211_S.mp4',
      );
      expect(media?.[0].getTitle()).toBe('2024-11-04 21:00');
    });

    it('should reject non-reolink results', () => {
      const query: EventQuery = {
        type: QueryType.Event,
        cameraIDs: new Set(['office']),
        start: new Date('2024-11-04T21:00:00'),
        end: new Date('2024-11-04T22:00:00'),
      };

      const results: QueryReturnType<EventQuery> = {
        engine: Engine.Frigate,
        type: QueryResultsType.Event,
      };

      const store = new CameraManagerStore();
      const engine = createEngine();
      const media = engine.generateMediaFromEvents(createHASS(), store, query, results);
      expect(media).toBeNull();
    });
  });

  describe('should get media metadata', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-11-17T15:06:00'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get media metadata successfully', async () => {
      const engine = createPopulatedEngine();
      const store = await createStoreWithReolinkCamera(engine);

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(TEST_CAMERAS)
        .mockResolvedValueOnce(TEST_DIRECTORIES);

      const metadata = await engine.getMediaMetadata(
        createHASS(),
        store,
        {
          type: QueryType.MediaMetadata,
          cameraIDs: new Set(['office']),
        },
        { useCache: false },
      );

      expect(metadata).toEqual(
        new Map([
          [
            {
              cameraIDs: new Set(['office']),
              type: 'media-metadata',
            },
            {
              cached: false,
              engine: 'reolink',
              expiry: new Date('2024-11-17T15:07:00'),
              metadata: {
                days: new Set(['2024-11-06', '2024-11-05', '2024-11-04']),
              },
              type: 'media-metadata-results',
            },
          ],
        ]),
      );
    });

    it('should cache media metadata', async () => {
      const engine = createPopulatedEngine();
      const store = await createStoreWithReolinkCamera(engine);

      vi.mocked(homeAssistantWSRequest)
        .mockResolvedValueOnce(TEST_CAMERAS)
        .mockResolvedValueOnce(TEST_DIRECTORIES);

      for (let i = 0; i < 10; i++) {
        await engine.getMediaMetadata(
          createHASS(),
          store,
          {
            type: QueryType.MediaMetadata,
            cameraIDs: new Set(['office']),
          },
          { useCache: true },
        );
      }

      expect(homeAssistantWSRequest).toHaveBeenCalledTimes(2);
    });

    describe('should ignore invalid cameras', () => {
      it('should get no metdata for camera without a config entry id', async () => {
        const entity = createRegistryEntity({
          entity_id: 'camera.office',
          unique_id: '85270002TS7D4RUP_0_main',
          platform: 'reolink',

          // Cannot fetch events without a config_entry_id.
          config_entry_id: null,
        });
        const entityRegistryManager = new EntityRegistryManagerMock([entity]);

        const engine = createEngine({ entityRegistryManager });
        const store = await createStoreWithReolinkCamera(engine);

        const metadata = await engine.getMediaMetadata(createHASS(), store, {
          type: QueryType.MediaMetadata,
          cameraIDs: new Set(['office']),
        });

        expect(metadata).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                type: 'media-metadata',
              },
              {
                cached: false,
                engine: 'reolink',
                expiry: new Date('2024-11-17T15:07:00'),
                metadata: {},
                type: 'media-metadata-results',
              },
            ],
          ]),
        );
      });

      it('should get no metdata for non-reolink camera', async () => {
        const engine = createPopulatedEngine();

        const store = new CameraManagerStore();
        store.addCamera(
          await createInitializedCamera(createCameraConfig({ id: 'office' }), engine),
        );

        const metadata = await engine.getMediaMetadata(createHASS(), store, {
          type: QueryType.MediaMetadata,
          cameraIDs: new Set(['office']),
        });

        expect(metadata).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                type: 'media-metadata',
              },
              {
                cached: false,
                engine: 'reolink',
                expiry: new Date('2024-11-17T15:07:00'),
                metadata: {},
                type: 'media-metadata-results',
              },
            ],
          ]),
        );
      });
    });

    describe('should ignore malformed directories', () => {
      it('malformed directory title', async () => {
        const engine = createPopulatedEngine();
        const store = await createStoreWithReolinkCamera(engine);

        vi.mocked(homeAssistantWSRequest)
          .mockResolvedValueOnce(TEST_CAMERAS)
          .mockResolvedValueOnce({
            title: 'Back Yard Low res.',
            media_class: 'channel',
            media_content_type: 'playlist',
            media_content_id:
              'media-source://reolink/DAYS|01J8XHYTNH77WE3C654K03KX1F|0|sub',
            children_media_class: 'directory',
            can_play: false,
            can_expand: true,
            thumbnail: null,
            children: [
              {
                // Malformed date.
                title: '__MALFORMED__',
                media_class: 'directory',
                media_content_type: 'playlist',
                media_content_id:
                  'media-source://reolink/DAY|01J8XHYTNH77WE3C654K03KX1F|0|sub|2024|11|4',
                children_media_class: null,
                can_play: false,
                can_expand: true,
                thumbnail: null,
              },
            ],
          });

        const metadata = await engine.getMediaMetadata(createHASS(), store, {
          type: QueryType.MediaMetadata,
          cameraIDs: new Set(['office']),
        });

        expect(metadata).toEqual(
          new Map([
            [
              {
                cameraIDs: new Set(['office']),
                type: 'media-metadata',
              },
              {
                cached: false,
                engine: 'reolink',
                expiry: new Date('2024-11-17T15:07:00'),
                metadata: {},
                type: 'media-metadata-results',
              },
            ],
          ]),
        );
      });
    });
  });
});
