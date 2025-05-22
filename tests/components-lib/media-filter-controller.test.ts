import { endOfDay, startOfDay, sub } from 'date-fns';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Capabilities } from '../../src/camera-manager/capabilities';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { QueryType } from '../../src/camera-manager/types';
import { ViewManager } from '../../src/card-controller/view/view-manager';
import {
  MediaFilterController,
  MediaFilterCoreDefaults,
  MediaFilterCoreFavoriteSelection,
  MediaFilterCoreWhen,
  MediaFilterMediaType,
} from '../../src/components-lib/media-filter-controller';
import { EventMediaQuery, Query, RecordingMediaQuery } from '../../src/view/query';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createLitElement,
  createPerformanceConfig,
  createStore,
  createView,
} from '../test-utils';

const createCameraStore = (options?: {
  capabilities: Capabilities;
}): CameraManagerStore => {
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

// @vitest-environment jsdom
describe('MediaFilterController', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should have correct default options', () => {
    it('media type', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getMediaTypeOptions()).toEqual([
        {
          value: MediaFilterMediaType.Clips,
          label: 'Clips',
        },
        {
          value: MediaFilterMediaType.Snapshots,
          label: 'Snapshots',
        },
        {
          value: MediaFilterMediaType.Recordings,
          label: 'Recordings',
        },
      ]);
    });

    it('favorite', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getFavoriteOptions()).toEqual([
        {
          value: MediaFilterCoreFavoriteSelection.Favorite,
          label: 'Favorite',
        },
        {
          value: MediaFilterCoreFavoriteSelection.NotFavorite,
          label: 'Not Favorite',
        },
      ]);
    });

    it('when', () => {
      const controller = new MediaFilterController(createLitElement());
      expect(controller.getWhenOptions()).toEqual([
        {
          value: MediaFilterCoreWhen.Today,
          label: 'Today',
        },
        {
          value: MediaFilterCoreWhen.Yesterday,
          label: 'Yesterday',
        },
        {
          value: MediaFilterCoreWhen.PastWeek,
          label: 'Past Week',
        },
        {
          value: MediaFilterCoreWhen.PastMonth,
          label: 'Past Month',
        },
        {
          value: MediaFilterCoreWhen.Custom,
          label: 'Custom',
        },
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
        controller.computeCameraOptions(cameraManager);
        expect(controller.getCameraOptions()).toEqual([
          {
            label: 'Kitchen Camera',
            value: 'camera.kitchen',
          },
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
        controller.computeCameraOptions(cameraManager);
        expect(controller.getCameraOptions()).toEqual([]);
      });

      it('without camera metadata', () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const controller = new MediaFilterController(createLitElement());
        controller.computeCameraOptions(cameraManager);
        expect(controller.getCameraOptions()).toEqual([
          {
            label: 'camera.kitchen',
            value: 'camera.kitchen',
          },
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
          {
            value: 'car',
            label: 'Car',
          },
          {
            value: 'person',
            label: 'Person',
          },
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
          {
            value: 'back_yard',
            label: 'Back Yard',
          },
          {
            value: 'front_door',
            label: 'Front Door',
          },
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
          {
            value: 'tag-1',
            label: 'Tag-1',
          },
          {
            value: 'tag-2',
            label: 'Tag-2',
          },
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

  describe('should get correct controls to show', () => {
    it('view with events', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView({ query: new EventMediaQuery() }));
      const cameraManager = createCameraManager();

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);
      expect(controller.getControlsToShow(cameraManager)).toMatchObject({
        events: true,
        recordings: false,
      });
    });

    it('view with recordings', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(
        createView({ query: new RecordingMediaQuery() }),
      );
      const cameraManager = createCameraManager();

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);
      expect(controller.getControlsToShow(cameraManager)).toMatchObject({
        events: false,
        recordings: true,
      });
    });

    it('can favorite events', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView({ query: new EventMediaQuery() }));
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({ 'favorite-events': true }),
      );

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      expect(controller.getControlsToShow(cameraManager)).toMatchObject({
        favorites: true,
      });
    });

    it('can favorite recordings', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(
        createView({ query: new RecordingMediaQuery() }),
      );

      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({ 'favorite-recordings': true }),
      );

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      expect(controller.getControlsToShow(cameraManager)).toMatchObject({
        favorites: true,
      });
    });

    it('can not favorite without a query', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const cameraManager = createCameraManager();

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      expect(controller.getControlsToShow(cameraManager)).toMatchObject({
        favorites: false,
      });
    });
  });

  describe('should handle value change', () => {
    it('must have visible cameras', async () => {
      const viewManager = mock<ViewManager>();

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(createCameraManager(), {}, { when: {} });

      expect(viewManager.setViewByParametersWithExistingQuery).not.toBeCalled();
    });

    describe('with events media type', () => {
      it.each([['clips' as const], ['snapshots' as const]])(
        '%s',
        async (viewName: 'clips' | 'snapshots') => {
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
            {
              performance: createPerformanceConfig({
                features: {
                  media_chunk_size: 11,
                },
              }),
            },
            {
              camera: 'camera.kitchen',
              mediaType:
                viewName === 'clips'
                  ? MediaFilterMediaType.Clips
                  : MediaFilterMediaType.Snapshots,
              when: {
                to: to,
                from: from,
              },
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
          expect(
            viewManager.setViewByParametersWithExistingQuery.mock.calls[0][0]?.params?.query?.getQuery(),
          ).toEqual([
            {
              cameraIDs: new Set(['camera.kitchen']),
              ...(viewName === 'clips' && { hasClip: true }),
              ...(viewName === 'snapshots' && { hasSnapshot: true }),
              type: 'event-query',
              tags: new Set(['tag-1', 'tag-2']),
              what: new Set(['what-1', 'what-2']),
              where: new Set(['where-1', 'where-2']),
              favorite: true,
              start: from,
              end: to,
              limit: 11,
            },
          ]);

          expect(host.requestUpdate).toBeCalled();
        },
      );
    });

    it('with recordings media type', async () => {
      const host = createLitElement();

      const cameraManager = createCameraManager(createCameraStore());

      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

      const controller = new MediaFilterController(host);
      controller.setViewManager(viewManager);

      const from = new Date('2024-02-06T21:59');
      const to = new Date('2024-02-06T22:00');

      await controller.valueChangeHandler(
        cameraManager,
        {
          performance: createPerformanceConfig({
            features: {
              media_chunk_size: 11,
            },
          }),
        },
        {
          mediaType: MediaFilterMediaType.Recordings,
          when: {
            to: to,
            from: from,
          },
          favorite: MediaFilterCoreFavoriteSelection.Favorite,
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({
          camera: 'camera.kitchen',
          view: 'recordings',
        }),
      });

      expect(
        viewManager.setViewByParametersWithExistingQuery.mock.calls[0][0]?.params?.query?.getQuery(),
      ).toEqual([
        {
          cameraIDs: new Set(['camera.kitchen']),
          type: 'recording-query',
          favorite: true,
          start: from,
          end: to,
          limit: 11,
        },
      ]);

      expect(host.requestUpdate).toBeCalled();
    });

    it('without favorites', async () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      await controller.valueChangeHandler(
        cameraManager,
        {},
        {
          mediaType: MediaFilterMediaType.Recordings,
          when: {},
        },
      );

      expect(viewManager.setViewByParametersWithExistingQuery).toBeCalledWith({
        params: expect.objectContaining({
          camera: 'camera.kitchen',
          view: 'recordings',
        }),
      });

      expect(
        viewManager.setViewByParametersWithExistingQuery.mock.calls[0][0]?.params?.query?.getQuery(),
      ).toEqual([
        {
          cameraIDs: new Set(['camera.kitchen']),
          type: 'recording-query',
        },
      ]);
    });

    describe('with fixed when selection', () => {
      const date = new Date('2024-10-01T17:14');

      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(date);
      });

      afterAll(() => {
        vi.useFakeTimers();
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
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const viewManager = mock<ViewManager>();
        viewManager.getView.mockReturnValue(createView());

        const controller = new MediaFilterController(createLitElement());
        controller.setViewManager(viewManager);

        await controller.valueChangeHandler(
          cameraManager,
          {},
          {
            mediaType: MediaFilterMediaType.Recordings,
            when: {
              selected: value,
            },
          },
        );
        expect(
          viewManager.setViewByParametersWithExistingQuery.mock.calls[0][0]?.params?.query?.getQuery(),
        ).toEqual([
          {
            cameraIDs: new Set(['camera.kitchen']),
            type: 'recording-query',
            start: from,
            end: to,
          },
        ]);
      });

      it('custom without values', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const viewManager = mock<ViewManager>();
        viewManager.getView.mockReturnValue(createView());

        const controller = new MediaFilterController(createLitElement());
        controller.setViewManager(viewManager);

        await controller.valueChangeHandler(
          cameraManager,
          {},
          {
            mediaType: MediaFilterMediaType.Recordings,
            when: {
              selected: MediaFilterCoreWhen.Custom,
            },
          },
        );

        expect(
          viewManager.setViewByParametersWithExistingQuery.mock.calls[0][0]?.params?.query?.getQuery(),
        ).toEqual([
          {
            cameraIDs: new Set(['camera.kitchen']),
            type: 'recording-query',
          },
        ]);
      });
    });
  });

  describe('should calculate correct defaults', () => {
    it('with no query', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      controller.computeInitialDefaultsFromView(cameraManager);

      expect(controller.getDefaults()).toBeNull();
    });

    it('with no raw queries', () => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(
        createView({
          query: new EventMediaQuery(),
        }),
      );

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      controller.computeInitialDefaultsFromView(cameraManager);

      expect(controller.getDefaults()).toBeNull();
    });

    it('with no cameras', () => {
      const viewManager = mock<ViewManager>();
      viewManager.getView.mockReturnValue(createView());

      const controller = new MediaFilterController(createLitElement());
      controller.setViewManager(viewManager);

      controller.computeInitialDefaultsFromView(createCameraManager());

      expect(controller.getDefaults()).toBeNull();
    });

    describe('for queries', () => {
      it.each([
        [
          'same cameras' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen', 'camera.living_room']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen', 'camera.living_room']),
            },
          ]),
          {
            cameraIDs: ['camera.kitchen', 'camera.living_room'],
          },
        ],
        [
          'different cameras' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.living_room']),
            },
          ]),
          {},
        ],
        [
          'all cameras' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
            },
          ]),
          {},
        ],
        [
          'different favorites ' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: undefined,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: false,
            },
          ]),
          {},
        ],
        [
          'all favorites' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: true,
            },
          ]),
          {
            favorite: MediaFilterCoreFavoriteSelection.Favorite,
          },
        ],
        [
          'all not favorites' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: false,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: false,
            },
          ]),
          {
            favorite: MediaFilterCoreFavoriteSelection.NotFavorite,
          },
        ],
        [
          'same hasClip' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: true,
            },
          ]),
          {
            mediaType: MediaFilterMediaType.Clips,
          },
        ],
        [
          'different hasClip' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: false,
            },
          ]),
          {},
        ],
        [
          'same hasSnapshot' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: true,
            },
          ]),
          {
            mediaType: MediaFilterMediaType.Snapshots,
          },
        ],
        [
          'different hasSnapshot' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: false,
            },
          ]),
          {},
        ],
        [
          'same what' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['person']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['person']),
            },
          ]),
          {
            what: ['person' as const],
          },
        ],
        [
          'different what' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['person']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['car']),
            },
          ]),
          {},
        ],
        [
          'same where' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['front_door']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['front_door']),
            },
          ]),
          {
            where: ['front_door' as const],
          },
        ],
        [
          'different where' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['front_door']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['back_steps']),
            },
          ]),
          {},
        ],
        [
          'same tags' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-1']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-1']),
            },
          ]),
          {
            tags: ['tag-1' as const],
          },
        ],
        [
          'different tags' as const,
          new EventMediaQuery([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-1']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-2']),
            },
          ]),
          {},
        ],
        [
          'recordings' as const,
          new RecordingMediaQuery([
            {
              type: QueryType.Recording,
              cameraIDs: new Set(['camera.kitchen']),
            },
          ]),
          {
            mediaType: MediaFilterMediaType.Recordings,
          },
        ],
      ])(
        '%s',
        (
          _name: string,
          mediaQueries: Query,
          defaults: MediaFilterCoreDefaults | null,
        ) => {
          const viewManager = mock<ViewManager>();
          viewManager.getView.mockReturnValue(
            createView({
              query: mediaQueries,
            }),
          );

          const controller = new MediaFilterController(createLitElement());
          controller.setViewManager(viewManager);

          const cameraManager = createCameraManager();
          vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

          controller.computeInitialDefaultsFromView(cameraManager);

          expect(controller.getDefaults()).toEqual(defaults);
        },
      );
    });
  });
});
