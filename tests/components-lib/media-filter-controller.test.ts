import { endOfDay, startOfDay, sub } from 'date-fns';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Capabilities } from '../../src/camera-manager/capabilities';
import {
  EventQuery,
  MediaQuery,
  QueryType,
  RecordingQuery,
  ReviewQuery,
} from '../../src/camera-manager/types';
import { FoldersManager } from '../../src/card-controller/folders/manager';
import { ViewManager } from '../../src/card-controller/view/view-manager';
import {
  MediaFilterController,
  MediaFilterCoreDefaults,
  MediaFilterCoreFavoriteSelection,
  MediaFilterCoreReviewedSelection,
  MediaFilterCoreWhen,
  MediaFilterMediaType,
} from '../../src/components-lib/media-filter-controller';
import { QuerySource } from '../../src/query-source';
import { UnifiedQuery } from '../../src/view/unified-query';
import {
  createCameraConfig,
  createCameraManager,
  createLitElement,
  createPerformanceConfig,
  createStore,
  createView,
} from '../test-utils';

const createCameraStore = (options?: { capabilities: Capabilities }) => {
  return createStore([
    {
      cameraID: 'camera.kitchen',
      config: createCameraConfig({
        camera_entity: 'camera.kitchen',
      }),
      capabilities:
        options?.capabilities ??
        new Capabilities({
          clips: true,
          snapshots: true,
          recordings: true,
        }),
    },
  ]);
};

const getQueryNodes = (viewManager: MockProxy<ViewManager>, n = 0): MediaQuery[] => {
  const query =
    viewManager.setViewByParametersWithExistingQuery.mock.calls[n]?.[0]?.params?.query;
  return query ? query.getMediaQueries() : [];
};

type TestQueryNode = (
  | Partial<Omit<EventQuery, 'source' | 'cameraIDs'>>
  | Partial<Omit<ReviewQuery, 'source' | 'cameraIDs'>>
  | Partial<Omit<RecordingQuery, 'source' | 'cameraIDs'>>
) & {
  type: QueryType;
  cameraID?: string;
  cameraIDs?: Set<string>;
};

const createQueryWithNodes = (nodes: TestQueryNode[]): UnifiedQuery => {
  const query = new UnifiedQuery();
  for (const node of nodes) {
    const { cameraID, cameraIDs: explicitCameraIDs, type, ...rest } = node;
    const cameraIDs = explicitCameraIDs ?? new Set([cameraID ?? 'camera.kitchen']);
    const mediaQuery: MediaQuery = {
      source: QuerySource.Camera,
      type,
      cameraIDs,
      ...rest,
    };
    query.addNode(mediaQuery);
  }
  return query;
};

const queryDefaultTestCases: Array<[string, UnifiedQuery, MediaFilterCoreDefaults]> = [
  [
    'same cameras',
    createQueryWithNodes([
      { type: QueryType.Event, cameraID: 'camera.kitchen', hasClip: true },
      { type: QueryType.Event, cameraID: 'camera.kitchen', hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'different cameras',
    createQueryWithNodes([
      { type: QueryType.Event, cameraID: 'camera.kitchen', hasClip: true },
      { type: QueryType.Event, cameraID: 'camera.living_room', hasClip: true },
    ]),
    {
      // cameraIDs included because they differ from visible cameras
      cameraIDs: ['camera.kitchen', 'camera.living_room'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'all favorites',
    createQueryWithNodes([
      { type: QueryType.Event, favorite: true, hasClip: true },
      { type: QueryType.Event, favorite: true, hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
      favorite: MediaFilterCoreFavoriteSelection.Favorite,
    },
  ],
  [
    'all not favorites',
    createQueryWithNodes([
      { type: QueryType.Event, favorite: false, hasClip: true },
      { type: QueryType.Event, favorite: false, hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
      favorite: MediaFilterCoreFavoriteSelection.NotFavorite,
    },
  ],
  [
    'different favorites',
    createQueryWithNodes([
      { type: QueryType.Event, favorite: true, hasClip: true },
      { type: QueryType.Event, favorite: false, hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'same hasClip',
    createQueryWithNodes([
      { type: QueryType.Event, hasClip: true },
      { type: QueryType.Event, hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'different hasClip',
    createQueryWithNodes([
      { type: QueryType.Event, hasClip: true },
      { type: QueryType.Event, hasClip: false },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'same hasSnapshot',
    createQueryWithNodes([
      { type: QueryType.Event, hasSnapshot: true },
      { type: QueryType.Event, hasSnapshot: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Snapshots],
    },
  ],
  [
    'different hasSnapshot',
    createQueryWithNodes([
      { type: QueryType.Event, hasSnapshot: true },
      { type: QueryType.Event, hasSnapshot: false },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Snapshots],
    },
  ],
  [
    'same what',
    createQueryWithNodes([
      { type: QueryType.Event, what: new Set(['person']), hasClip: true },
      { type: QueryType.Event, what: new Set(['person']), hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
      what: ['person'],
    },
  ],
  [
    'different what',
    createQueryWithNodes([
      { type: QueryType.Event, what: new Set(['person']), hasClip: true },
      { type: QueryType.Event, what: new Set(['car']), hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'same where',
    createQueryWithNodes([
      { type: QueryType.Event, where: new Set(['front_door']), hasClip: true },
      { type: QueryType.Event, where: new Set(['front_door']), hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
      where: ['front_door'],
    },
  ],
  [
    'different where',
    createQueryWithNodes([
      { type: QueryType.Event, where: new Set(['front_door']), hasClip: true },
      { type: QueryType.Event, where: new Set(['back_steps']), hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'same tags',
    createQueryWithNodes([
      { type: QueryType.Event, tags: new Set(['tag-1']), hasClip: true },
      { type: QueryType.Event, tags: new Set(['tag-1']), hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
      tags: ['tag-1'],
    },
  ],
  [
    'different tags',
    createQueryWithNodes([
      { type: QueryType.Event, tags: new Set(['tag-1']), hasClip: true },
      { type: QueryType.Event, tags: new Set(['tag-2']), hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'recordings',
    createQueryWithNodes([{ type: QueryType.Recording }]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Recordings],
    },
  ],
  [
    'reviews',
    createQueryWithNodes([{ type: QueryType.Review }]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Reviews],
    },
  ],
  [
    'reviewed true',
    createQueryWithNodes([{ type: QueryType.Review, reviewed: true }]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Reviews],
      reviewed: MediaFilterCoreReviewedSelection.Reviewed,
    },
  ],
  [
    'reviewed false',
    createQueryWithNodes([{ type: QueryType.Review, reviewed: false }]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Reviews],
      reviewed: MediaFilterCoreReviewedSelection.NotReviewed,
    },
  ],
  [
    'mixed favorites',
    createQueryWithNodes([
      { type: QueryType.Event, favorite: true, hasClip: true },
      { type: QueryType.Event, favorite: false, hasClip: true },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Clips],
    },
  ],
  [
    'mixed reviewed',
    createQueryWithNodes([
      { type: QueryType.Review, reviewed: true },
      { type: QueryType.Review, reviewed: false },
    ]),
    {
      cameraIDs: ['camera.kitchen'],
      mediaTypes: [MediaFilterMediaType.Reviews],
    },
  ],
];

// @vitest-environment jsdom
describe('MediaFilterController', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should have correct default options', () => {
    it('media type', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getMediaTypeOptions()).toEqual([
        { value: MediaFilterMediaType.Clips, label: 'Clips' },
        { value: MediaFilterMediaType.Snapshots, label: 'Snapshots' },
        { value: MediaFilterMediaType.Recordings, label: 'Recordings' },
        { value: MediaFilterMediaType.Reviews, label: 'Reviews' },
      ]);
    });

    it('favorite', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getFavoriteOptions()).toEqual([
        { value: MediaFilterCoreFavoriteSelection.Favorite, label: 'Favorite' },
        { value: MediaFilterCoreFavoriteSelection.NotFavorite, label: 'Not Favorite' },
      ]);
    });

    it('reviewed', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getReviewedOptions()).toEqual([
        { value: MediaFilterCoreReviewedSelection.Reviewed, label: 'Reviewed' },
        { value: MediaFilterCoreReviewedSelection.NotReviewed, label: 'Not Reviewed' },
      ]);
    });

    it('when', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getWhenOptions()).toEqual([
        { value: MediaFilterCoreWhen.Today, label: 'Today' },
        { value: MediaFilterCoreWhen.Yesterday, label: 'Yesterday' },
        { value: MediaFilterCoreWhen.PastWeek, label: 'Past Week' },
        { value: MediaFilterCoreWhen.PastMonth, label: 'Past Month' },
        { value: MediaFilterCoreWhen.Custom, label: 'Custom' },
      ]);
    });

    it('cameras', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getCameraOptions()).toEqual([]);
    });

    it('what', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getWhatOptions()).toEqual([]);
    });

    it('where', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getWhereOptions()).toEqual([]);
    });

    it('tags', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getTagsOptions()).toEqual([]);
    });
  });

  describe('should calculate correct dynamic options', () => {
    describe('cameras', () => {
      it('with valid camera', () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
          title: 'Kitchen Camera',
          icon: { icon: 'mdi:camera' },
        });
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const controller = new MediaFilterController(createLitElement());
        controller.computeCameraOptions(cameraManager, mock<FoldersManager>());
        expect(controller.getCameraOptions()).toEqual([
          { label: 'Kitchen Camera', value: 'camera.kitchen' },
        ]);
      });

      it('with camera that does not support media', () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
          title: 'Kitchen Camera',
          icon: { icon: 'mdi:camera' },
        });
        vi.mocked(cameraManager.getStore).mockReturnValue(
          createCameraStore({
            capabilities: new Capabilities({
              clips: false,
              snapshots: false,
              recordings: false,
            }),
          }),
        );

        const controller = new MediaFilterController(createLitElement());
        controller.computeCameraOptions(cameraManager, mock<FoldersManager>());
        expect(controller.getCameraOptions()).toEqual([]);
      });

      it('without camera metadata', () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const controller = new MediaFilterController(createLitElement());
        controller.computeCameraOptions(cameraManager, mock<FoldersManager>());
        expect(controller.getCameraOptions()).toEqual([
          { label: 'camera.kitchen', value: 'camera.kitchen' },
        ]);
      });
    });

    describe('metadata', () => {
      it('with failed getMediaMetadata call', async () => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockRejectedValue(new Error('error'));

        const host = createLitElement();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(host.requestUpdate).not.toBeCalled();
      });

      it('with metadata for what', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          what: new Set(['person', 'car']),
        });

        const host = createLitElement();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(controller.getWhatOptions()).toEqual([
          { value: 'car', label: 'Car' },
          { value: 'person', label: 'Person' },
        ]);
        expect(host.requestUpdate).toBeCalled();
      });

      it('with metadata for where', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          where: new Set(['front_door', 'back_yard']),
        });

        const host = createLitElement();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(controller.getWhereOptions()).toEqual([
          { value: 'back_yard', label: 'Back Yard' },
          { value: 'front_door', label: 'Front Door' },
        ]);
        expect(host.requestUpdate).toBeCalled();
      });

      it('with metadata for tags', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          tags: new Set(['tag-1', 'tag-2']),
        });

        const host = createLitElement();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(controller.getTagsOptions()).toEqual([
          { value: 'tag-1', label: 'Tag-1' },
          { value: 'tag-2', label: 'Tag-2' },
        ]);
        expect(host.requestUpdate).toBeCalled();
      });

      it('with metadata for days', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          days: new Set(['2024-02-04', '2024-02-05']),
        });

        const host = createLitElement();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);

        expect(controller.getWhenOptions()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              value: '2024-02-01,2024-02-29',
              label: 'February 2024',
            }),
          ]),
        );
        expect(host.requestUpdate).toBeCalled();
      });
    });
  });

  describe('should handle value change', () => {
    it('must have visible cameras', async () => {
      const viewManager = mock<ViewManager>();

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        createCameraManager(),
        mock<FoldersManager>(),
        {},
        { when: {} },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).not.toBeCalled();
    });

    describe('with events media type', () => {
      it.each([
        ['clips', MediaFilterMediaType.Clips],
        ['snapshots', MediaFilterMediaType.Snapshots],
      ])('%s', async (viewName: string, mediaType: MediaFilterMediaType) => {
        const host = createLitElement();
        const viewManager = mock<ViewManager>();
        viewManager.getView.mockReturnValue(createView());

        const controller = new MediaFilterController(host);
        controller.setViewManager(viewManager);

        const cameraManager = createCameraManager(createCameraStore());

        const from = new Date('2024-02-06T21:59');
        const to = new Date('2024-02-06T22:00');

        await controller.valueChangeHandler(
          cameraManager,
          mock<FoldersManager>(),
          {
            performance: createPerformanceConfig({
              features: { media_chunk_size: 11 },
            }),
          },
          {
            camera: ['camera.kitchen'],
            mediaTypes: [mediaType],
            when: { to, from },
            tags: ['tag-1', 'tag-2'],
            what: ['what-1', 'what-2'],
            where: ['where-1', 'where-2'],
            favorite: MediaFilterCoreFavoriteSelection.Favorite,
          },
        );

        expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
          params: expect.objectContaining({
            camera: 'camera.kitchen',
            view: viewName,
          }),
        });

        const nodes = getQueryNodes(viewManager);
        expect(nodes).toHaveLength(1);
        expect(nodes?.[0]).toMatchObject({
          type: QueryType.Event,
          cameraIDs: new Set(['camera.kitchen']),
          ...(mediaType === MediaFilterMediaType.Clips && { hasClip: true }),
          ...(mediaType === MediaFilterMediaType.Snapshots && { hasSnapshot: true }),
          tags: new Set(['tag-1', 'tag-2']),
          what: new Set(['what-1', 'what-2']),
          where: new Set(['where-1', 'where-2']),
          favorite: true,
          start: from,
          end: to,
          limit: 11,
        });

        expect(host.requestUpdate).toBeCalled();
      });
    });

    it('with recordings media type', async () => {
      const host = createLitElement();
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(host);
      controller.setViewManager(viewManager);

      const from = new Date('2024-02-06T21:59');
      const to = new Date('2024-02-06T22:00');

      await controller.valueChangeHandler(
        cameraManager,
        mock<FoldersManager>(),
        {
          performance: createPerformanceConfig({
            features: { media_chunk_size: 11 },
          }),
        },
        {
          mediaTypes: [MediaFilterMediaType.Recordings],
          when: { to, from },
          favorite: MediaFilterCoreFavoriteSelection.Favorite,
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({
          camera: 'camera.kitchen',
          view: 'recordings',
        }),
      });

      const nodes = getQueryNodes(viewManager);
      expect(nodes).toHaveLength(1);
      expect(nodes?.[0]).toMatchObject({
        type: QueryType.Recording,
        cameraIDs: new Set(['camera.kitchen']),
        favorite: true,
        start: from,
        end: to,
        limit: 11,
      });

      expect(host.requestUpdate).toBeCalled();
    });

    it('with reviews media type', async () => {
      const host = createLitElement();
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(host);
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        cameraManager,
        mock<FoldersManager>(),
        {},
        {
          mediaTypes: [MediaFilterMediaType.Reviews],
          when: {},
          reviewed: MediaFilterCoreReviewedSelection.NotReviewed,
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({ view: 'reviews' }),
      });

      const nodes = getQueryNodes(viewManager);
      expect(nodes).toHaveLength(1);
      expect(nodes?.[0]).toMatchObject({
        type: QueryType.Review,
        reviewed: false,
      });
    });

    it('with multiple media types uses media view', async () => {
      const host = createLitElement();
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(host);
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        cameraManager,
        mock<FoldersManager>(),
        {},
        {
          mediaTypes: [MediaFilterMediaType.Clips, MediaFilterMediaType.Recordings],
          when: {},
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({ view: 'media' }),
      });

      const nodes = getQueryNodes(viewManager);
      expect(nodes).toHaveLength(2);
      expect(nodes?.map((s) => s.type)).toEqual([QueryType.Event, QueryType.Recording]);
    });

    it('all favorites', async () => {
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        cameraManager,
        mock<FoldersManager>(),
        {},
        {
          mediaTypes: [MediaFilterMediaType.Clips],
          when: {},
          favorite: MediaFilterCoreFavoriteSelection.Favorite,
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({
          camera: 'camera.kitchen',
          view: 'clips',
        }),
      });

      const nodes = getQueryNodes(viewManager);
      expect(nodes).toHaveLength(1);
      expect(nodes?.[0]).toMatchObject({
        type: QueryType.Event,
        cameraIDs: new Set(['camera.kitchen']),
        favorite: true,
      });
    });

    it('without favorites', async () => {
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        cameraManager,
        mock<FoldersManager>(),
        {},
        {
          mediaTypes: [MediaFilterMediaType.Recordings],
          when: {},
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({
          camera: 'camera.kitchen',
          view: 'recordings',
        }),
      });

      const nodes = getQueryNodes(viewManager);
      expect(nodes).toHaveLength(1);
      expect(nodes?.[0]).toMatchObject({
        type: QueryType.Recording,
        cameraIDs: new Set(['camera.kitchen']),
      });
      expect(nodes?.[0].favorite).toBeUndefined();
    });

    it('with no media types selects all types', async () => {
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        cameraManager,
        mock<FoldersManager>(),
        {},
        {
          mediaTypes: [],
          when: {},
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({ view: 'media' }),
      });

      const nodes = getQueryNodes(viewManager);
      // All 4 types selected for the single camera
      expect(nodes).toHaveLength(4);
      expect(nodes?.map((s) => s.type).sort()).toEqual([
        QueryType.Event,
        QueryType.Event,
        QueryType.Recording,
        QueryType.Review,
      ]);
    });

    describe('with fixed when selection', () => {
      const date = new Date('2024-10-01T17:14');

      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(date);
      });

      afterAll(() => {
        vi.useRealTimers();
      });

      it.each([
        [MediaFilterCoreWhen.Today, startOfDay(date), endOfDay(date)],
        [
          MediaFilterCoreWhen.Yesterday,
          startOfDay(sub(date, { days: 1 })),
          endOfDay(sub(date, { days: 1 })),
        ],
        [
          MediaFilterCoreWhen.PastWeek,
          startOfDay(sub(date, { days: 7 })),
          endOfDay(date),
        ],
        [
          MediaFilterCoreWhen.PastMonth,
          startOfDay(sub(date, { months: 1 })),
          endOfDay(date),
        ],
        [
          '2024-02-01,2024-02-29',
          new Date('2024-02-01T00:00:00'),
          new Date('2024-02-29T23:59:59.999'),
        ],
      ])('%s', async (value: MediaFilterCoreWhen | string, from: Date, to: Date) => {
        const cameraManager = createCameraManager(createCameraStore());
        const viewManager = mock<ViewManager>();
        viewManager.getView.mockReturnValue(createView());

        const controller = new MediaFilterController(createLitElement());
        controller.setViewManager(viewManager);

        await controller.valueChangeHandler(
          cameraManager,
          mock<FoldersManager>(),
          {},
          {
            mediaTypes: [MediaFilterMediaType.Recordings],
            when: { selected: value },
          },
        );

        const nodes = getQueryNodes(viewManager);
        expect(nodes?.[0]).toMatchObject({
          type: QueryType.Recording,
          cameraIDs: new Set(['camera.kitchen']),
          start: from,
          end: to,
        });
      });

      it('custom without values', async () => {
        const cameraManager = createCameraManager(createCameraStore());
        const viewManager = mock<ViewManager>();
        viewManager.getView.mockReturnValue(createView());

        const controller = new MediaFilterController(createLitElement());
        controller.setViewManager(viewManager);

        await controller.valueChangeHandler(
          cameraManager,
          mock<FoldersManager>(),
          {},
          {
            mediaTypes: [MediaFilterMediaType.Recordings],
            when: { selected: MediaFilterCoreWhen.Custom },
          },
        );

        const nodes = getQueryNodes(viewManager);
        expect(nodes?.[0]).toMatchObject({
          type: QueryType.Recording,
          cameraIDs: new Set(['camera.kitchen']),
        });
        expect(nodes?.[0].start).toBeUndefined();
        expect(nodes?.[0].end).toBeUndefined();
      });
    });
  });

  describe('should calculate correct defaults', () => {
    it('with no query', () => {
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      controller.computeInitialDefaultsFromView(cameraManager, mock<FoldersManager>());

      expect(controller.getDefaults()).toBeNull();
    });

    it('with empty query', () => {
      const cameraManager = createCameraManager(createCameraStore());
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView({ query: new UnifiedQuery() }));

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      controller.computeInitialDefaultsFromView(cameraManager, mock<FoldersManager>());

      expect(controller.getDefaults()).toBeNull();
    });

    it('with no cameras', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      controller.computeInitialDefaultsFromView(
        createCameraManager(),
        mock<FoldersManager>(),
      );

      expect(controller.getDefaults()).toBeNull();
    });

    describe('for queries', () => {
      it.each(queryDefaultTestCases)(
        '%s',
        (_name: string, query: UnifiedQuery, expected: MediaFilterCoreDefaults) => {
          const cameraManager = createCameraManager(createCameraStore());
          const viewManager = mock<ViewManager>();
          viewManager.getView.mockReturnValue(
            createView({
              camera: 'camera.kitchen',
              query: query,
            }),
          );

          const controller = new MediaFilterController(createLitElement());
          controller.setViewManager(viewManager);

          controller.computeInitialDefaultsFromView(
            cameraManager,
            mock<FoldersManager>(),
          );

          expect(controller.getDefaults()).toEqual(expected);
        },
      );
    });
  });
});
