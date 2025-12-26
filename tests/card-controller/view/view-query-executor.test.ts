import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Capabilities } from '../../../src/camera-manager/capabilities';
import { applyViewModifiers } from '../../../src/card-controller/view/modifiers';
import { QueryExecutor } from '../../../src/card-controller/view/query-executor';
import { ViewQueryExecutor } from '../../../src/card-controller/view/view-query-executor';
import { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import {
  EventMediaQuery,
  FolderViewQuery,
  RecordingMediaQuery,
} from '../../../src/view/query';
import { QueryResults } from '../../../src/view/query-results';
import { View } from '../../../src/view/view';
import { createCardAPI, createView } from '../../test-utils';
import { createPopulatedAPI } from './test-utils';

describe('ViewQueryExecutor', () => {
  describe('getExistingQueryModifiers', () => {
    it('should return modifier with result when query present', async () => {
      const executor = mock<QueryExecutor>();
      const viewQueryExecutor = new ViewQueryExecutor(createCardAPI(), executor);

      const query = new EventMediaQuery();
      const queryResults = new QueryResults();
      const view = createView({
        query: query,
      });

      executor.executeQuery.mockResolvedValue({ query, queryResults });

      const queryExecutorOptions = { useCache: true };
      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(
        view,
        queryExecutorOptions,
      );

      applyViewModifiers(view, modifiers);

      expect(view.query).toBe(query);
      expect(view.queryResults).toBe(queryResults);
      expect(executor.executeQuery).toBeCalledWith(query, queryExecutorOptions);
    });

    it('should not return modifier when query absent', async () => {
      const executor = mock<QueryExecutor>();
      const viewQueryExecutor = new ViewQueryExecutor(createCardAPI(), executor);

      const view = createView();

      const queryExecutorOptions = {};
      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(
        view,
        queryExecutorOptions,
      );

      expect(modifiers?.length).toBe(0);

      applyViewModifiers(view, modifiers);

      expect(view.query).toBeNull();
      expect(view.queryResults).toBeNull();
      expect(executor.executeMediaQuery).not.toBeCalled();
    });
  });

  describe('getNewQueryModifiers', () => {
    it('should return null without config', async () => {
      const factory = new ViewQueryExecutor(createCardAPI());
      expect(await factory.getNewQueryModifiers(createView())).toBeNull();
    });

    describe('with a live view', () => {
      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-07-21T13:22:06Z'));
      });

      afterAll(() => {
        vi.useRealTimers();
      });

      it('should set query and queryResults for reviews', async () => {
        const query = new EventMediaQuery();
        const queryResults = new QueryResults();

        const executor = mock<QueryExecutor>();
        executor.executeDefaultReviewQuery.mockResolvedValue({
          query,
          queryResults,
        });

        const api = createPopulatedAPI();
        vi.mocked(api.getCameraManager().getCameraCapabilities).mockReturnValue(
          new Capabilities({ reviews: true }),
        );

        const viewQueryExecutor = new ViewQueryExecutor(api, executor);
        const view = createView({ view: 'live', camera: 'camera.office' });
        const queryExecutorOptions = {};

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(
          view,
          queryExecutorOptions,
        );
        applyViewModifiers(view, modifiers);

        expect(view.query).toBe(query);
        expect(view.queryResults).toBe(queryResults);
      });

      it('should set query and queryResults for events', async () => {
        const query = new EventMediaQuery();
        const queryResults = new QueryResults();

        const executor = mock<QueryExecutor>();
        executor.executeDefaultEventQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        // Must not return 'reviews' capability.
        const api = createPopulatedAPI();
        vi.mocked(api.getCameraManager()?.getCameraCapabilities).mockReturnValue(
          new Capabilities({ clips: true, snapshots: true }),
        );

        const viewQueryExecutor = new ViewQueryExecutor(api, executor);
        const view = createView({ view: 'live', camera: 'camera.office' });
        const queryExecutorOptions = {};

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(
          view,
          queryExecutorOptions,
        );
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        expect(executor.executeDefaultEventQuery).toBeCalledWith({
          cameraID: 'camera.office',
          eventsMediaType: 'all',
          executorOptions: {
            useCache: false,
          },
        });
        expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
        expect(executor.executeFolderQuery).not.toHaveBeenCalled();
      });

      it('should use events_media_type when camera does not have reviews capability', async () => {
        const query = new EventMediaQuery();
        const queryResults = new QueryResults();

        const executor = mock<QueryExecutor>();
        executor.executeDefaultEventQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        const api = createPopulatedAPI();
        // Mock camera capabilities to NOT have reviews - this forces resolvedMediaType === 'events'.
        vi.mocked(api.getCameraManager()?.getCameraCapabilities).mockReturnValue(
          new Capabilities({ clips: true, snapshots: true }),
        );

        const viewQueryExecutor = new ViewQueryExecutor(api, executor);
        const view = createView({ view: 'live', camera: 'camera.office' });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        // When resolvedMediaType === 'events', it uses config.live.controls.thumbnails.events_media_type.
        expect(executor.executeDefaultEventQuery).toBeCalledWith({
          cameraID: 'camera.office',
          eventsMediaType: 'all',
          executorOptions: {
            useCache: false,
          },
        });
      });

      it('should set query and queryResults for recordings', async () => {
        const query = new RecordingMediaQuery();
        const queryResults = new QueryResults();

        const executor = mock<QueryExecutor>();
        executor.executeDefaultRecordingQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        const viewQueryExecutor = new ViewQueryExecutor(
          createPopulatedAPI({
            live: {
              controls: {
                thumbnails: {
                  media_type: 'recordings',
                },
              },
            },
          }),
          executor,
        );
        const view = createView({ view: 'live', camera: 'camera.office' });
        const queryExecutorOptions = {};

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(
          view,
          queryExecutorOptions,
        );
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        expect(executor.executeDefaultRecordingQuery).toBeCalledWith({
          cameraID: 'camera.office',
          executorOptions: {
            useCache: false,
          },
        });
        expect(executor.executeDefaultEventQuery).not.toBeCalled();
        expect(executor.executeFolderQuery).not.toHaveBeenCalled();
      });

      describe('should set timeline window', async () => {
        it('should set timeline to now for live views', async () => {
          const executor = mock<QueryExecutor>();
          const viewQueryExecutor = new ViewQueryExecutor(
            createPopulatedAPI(),
            executor,
          );
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view?.context).toEqual({
            timeline: {
              window: {
                start: new Date('2024-07-21T12:22:06.000Z'),
                end: new Date('2024-07-21T13:22:06.000Z'),
              },
            },
          });
        });

        it('should unset timeline for non-live views', async () => {
          const executor = mock<QueryExecutor>();
          const viewQueryExecutor = new ViewQueryExecutor(
            createPopulatedAPI(),
            executor,
          );
          const view = createView({
            view: 'clips',
            camera: 'camera.office',
            context: {
              timeline: {
                window: {
                  start: new Date('2024-07-21T12:22:06.000Z'),
                  end: new Date('2024-07-21T13:22:06.000Z'),
                },
              },
            },
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view?.context).toEqual({ timeline: {} });
        });
      });

      it('should not fetch anything if configured for no thumbnails', async () => {
        const executor = mock<QueryExecutor>();
        const viewQueryExecutor = new ViewQueryExecutor(
          createPopulatedAPI({
            live: {
              controls: {
                thumbnails: {
                  mode: 'none' as const,
                },
              },
            },
          }),
          executor,
        );

        const view = createView({
          view: 'live',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBeNull();
        expect(view?.queryResults).toBeNull();
        expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
        expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
        expect(executor.executeFolderQuery).not.toHaveBeenCalled();
      });
    });

    describe('with a media view', () => {
      it('should set query and queryResults for events', async () => {
        const executor = mock<QueryExecutor>();
        const query = new EventMediaQuery();
        const queryResults = new QueryResults();

        executor.executeDefaultEventQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI(), executor);
        const view = new View({
          view: 'media',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        expect(executor.executeDefaultEventQuery).toBeCalledWith({
          cameraID: 'camera.office',
          eventsMediaType: 'clips',
          executorOptions: {
            useCache: false,
          },
        });
        expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
        expect(executor.executeFolderQuery).not.toHaveBeenCalled();
      });
    });

    describe('with an events-based view', () => {
      it.each([
        ['clip' as const, 'clips' as const],
        ['clips' as const, 'clips' as const],
        ['snapshot' as const, 'snapshots' as const],
        ['snapshots' as const, 'snapshots' as const],
      ])(
        '%s',
        async (
          viewName: AdvancedCameraCardView,
          eventsMediaType: 'clips' | 'snapshots',
        ) => {
          const executor = mock<QueryExecutor>();
          const query = new EventMediaQuery();
          const queryResults = new QueryResults();

          executor.executeDefaultEventQuery.mockResolvedValue({
            query: query,
            queryResults: queryResults,
          });

          const viewQueryExecutor = new ViewQueryExecutor(
            createPopulatedAPI(),
            executor,
          );
          const view = new View({
            view: viewName,
            camera: 'camera.office',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view?.query).toBe(query);
          expect(view?.queryResults).toBe(queryResults);
          expect(executor.executeDefaultEventQuery).toBeCalledWith({
            cameraID: 'camera.office',
            eventsMediaType: eventsMediaType,
            executorOptions: {
              useCache: false,
            },
          });
          expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
          expect(executor.executeFolderQuery).not.toHaveBeenCalled();
        },
      );
    });

    describe('with a recordings-based view', () => {
      it.each([['recording' as const], ['recordings' as const]])(
        '%s',
        async (viewName: AdvancedCameraCardView) => {
          const executor = mock<QueryExecutor>();
          const query = new RecordingMediaQuery();
          const queryResults = new QueryResults();

          executor.executeDefaultRecordingQuery.mockResolvedValue({
            query: query,
            queryResults: queryResults,
          });

          const viewQueryExecutor = new ViewQueryExecutor(
            createPopulatedAPI(),
            executor,
          );
          const view = new View({
            view: viewName,
            camera: 'camera.office',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view?.query).toBe(query);
          expect(view?.queryResults).toBe(queryResults);
          expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
          expect(executor.executeDefaultRecordingQuery).toBeCalledWith({
            cameraID: 'camera.office',
            executorOptions: {
              useCache: false,
            },
          });
          expect(executor.executeFolderQuery).not.toHaveBeenCalled();
        },
      );
    });

    describe('with a folder view', () => {
      it('should execute default folder query with folder view', async () => {
        const executor = mock<QueryExecutor>();
        const query = new FolderViewQuery();
        const queryResults = new QueryResults();

        executor.executeFolderQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI(), executor);
        const view = createView({ view: 'folder', camera: 'camera.office' });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        expect(executor.executeDefaultEventQuery).not.toBeCalled();
        expect(executor.executeDefaultRecordingQuery).not.toBeCalled();
        expect(executor.executeFolderQuery).toBeCalledWith({
          useCache: false,
        });
      });

      it('should execute default folder query with folder view and handle null results', async () => {
        const executor = mock<QueryExecutor>();
        executor.executeFolderQuery.mockResolvedValue(null);

        const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI(), executor);
        const view = createView({ view: 'folder', camera: 'camera.office' });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view?.query).toBeNull();
        expect(view?.queryResults).toBeNull();
      });
    });

    describe('when setting or removing seek time', () => {
      it('should set seek time when results are selected based on time', async () => {
        const now = new Date();
        const executor = mock<QueryExecutor>();
        const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI(), executor);

        const view = new View({
          view: 'clip',
          camera: 'camera.office',
        });

        const queryExecutorOptions = {
          selectResult: {
            time: {
              time: now,
            },
          },
        };

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(
          view,
          queryExecutorOptions,
        );
        applyViewModifiers(view, modifiers);

        expect(view?.context).toEqual({
          mediaViewer: {
            seek: now,
          },
        });
      });

      it('should remove seek time when results are not selected based on time', async () => {
        const executor = mock<QueryExecutor>();
        const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI(), executor);

        const view = new View({
          view: 'clip',
          camera: 'camera.office',
          context: {
            mediaViewer: {
              seek: new Date(),
            },
          },
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view?.context?.mediaViewer?.seek).toBeUndefined();
      });
    });

    it('should set query for reviews view', async () => {
      const query = new EventMediaQuery();
      const queryResults = new QueryResults();

      const executor = mock<QueryExecutor>();
      executor.executeDefaultReviewQuery.mockResolvedValue({
        query: query,
        queryResults: queryResults,
      });

      const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI(), executor);
      const view = createView({ view: 'reviews', camera: 'camera.office' });
      const queryExecutorOptions = {};

      const modifiers = await viewQueryExecutor.getNewQueryModifiers(
        view,
        queryExecutorOptions,
      );
      applyViewModifiers(view, modifiers);

      expect(view.query).toBe(query);
      expect(view.queryResults).toBe(queryResults);
    });
  });
});
