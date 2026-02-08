import { afterAll, assert, beforeAll, describe, expect, it, vi } from 'vitest';
import { Capabilities } from '../../../src/camera-manager/capabilities';
import { EventQuery, QueryType } from '../../../src/camera-manager/types';
import { applyViewModifiers } from '../../../src/card-controller/view/modifiers';
import { ViewQueryExecutor } from '../../../src/card-controller/view/view-query-executor';
import { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import { PerformanceConfig } from '../../../src/config/schema/performance';
import { QuerySource } from '../../../src/query-source';
import { UnifiedQuery } from '../../../src/view/unified-query';
import { View } from '../../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createPerformanceConfig,
  createStore,
  createView,
  isEventQuery,
  TestViewMedia,
} from '../../test-utils';
import { createPopulatedAPI } from './test-utils';

describe('ViewQueryExecutor', () => {
  describe('getExistingQueryModifiers', () => {
    it('should return modifier with result when query present', async () => {
      const api = createPopulatedAPI();
      const viewQueryExecutor = new ViewQueryExecutor(api);

      const query = new UnifiedQuery();
      const view = createView({
        query: query,
      });

      const options = { useCache: true };
      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(view, options);

      applyViewModifiers(view, modifiers);

      expect(view.query).toBe(query);
      expect(view.queryResults).toBeDefined();
    });

    it('should not return modifier when query absent', async () => {
      const api = createPopulatedAPI();
      const viewQueryExecutor = new ViewQueryExecutor(api);

      const view = createView();

      const options = {};
      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(view, options);

      expect(modifiers).toBeNull();

      applyViewModifiers(view, modifiers);

      expect(view.query).toBeNull();
      expect(view.queryResults).toBeNull();
    });

    it('should return null when rejectResults returns true', async () => {
      const api = createPopulatedAPI();
      const viewQueryExecutor = new ViewQueryExecutor(api);

      const query = new UnifiedQuery();
      const view = createView({ query });

      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(view, {
        rejectResults: () => true,
      });

      expect(modifiers).toBeNull();
    });

    it('should select result by id', async () => {
      const api = createPopulatedAPI();
      const viewQueryExecutor = new ViewQueryExecutor(api);

      const media = new TestViewMedia({ id: 'test-id' });

      // Mock the camera manager to return our test media when query is executed
      const cameraManager = api.getCameraManager();
      if (cameraManager) {
        vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([media]);
      }

      const query = new UnifiedQuery();
      const eventQuery: EventQuery = {
        source: QuerySource.Camera,
        type: QueryType.Event,
        cameraIDs: new Set(['camera.office']),
        hasClip: true,
      };
      query.addNode(eventQuery);

      const view = new View({
        view: 'clips',
        camera: 'camera.office',
        query,
      });

      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(view, {
        selectResult: { id: 'test-id' },
      });

      applyViewModifiers(view, modifiers);

      expect(view.queryResults).not.toBeNull();
      expect(view.queryResults?.getSelectedResult()?.getID()).toBe('test-id');
    });

    it('should select result by func', async () => {
      const api = createPopulatedAPI();
      const viewQueryExecutor = new ViewQueryExecutor(api);

      const media = new TestViewMedia({ id: 'test-id' });

      const cameraManager = api.getCameraManager();
      if (cameraManager) {
        vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([media]);
      }

      const query = new UnifiedQuery();
      const eventQuery: EventQuery = {
        source: QuerySource.Camera,
        type: QueryType.Event,
        cameraIDs: new Set(['camera.office']),
        hasClip: true,
      };
      query.addNode(eventQuery);

      const view = new View({
        view: 'clips',
        camera: 'camera.office',
        query,
      });

      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(view, {
        selectResult: { func: (item) => item.getID() === 'test-id' },
      });

      applyViewModifiers(view, modifiers);

      expect(view.queryResults).not.toBeNull();
      expect(view.queryResults?.getSelectedResult()?.getID()).toBe('test-id');
    });

    it('should select result by time', async () => {
      const api = createPopulatedAPI();
      const viewQueryExecutor = new ViewQueryExecutor(api);

      const now = new Date();
      const media = new TestViewMedia({ id: 'test-id', startTime: now });

      const cameraManager = api.getCameraManager();
      if (cameraManager) {
        vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([media]);
      }

      const query = new UnifiedQuery();
      const eventQuery: EventQuery = {
        source: QuerySource.Camera,
        type: QueryType.Event,
        cameraIDs: new Set(['camera.office']),
        hasClip: true,
      };
      query.addNode(eventQuery);

      const view = new View({
        view: 'clips',
        camera: 'camera.office',
        query,
      });

      const modifiers = await viewQueryExecutor.getExistingQueryModifiers(view, {
        selectResult: { time: { time: now } },
      });

      applyViewModifiers(view, modifiers);

      expect(view.queryResults).not.toBeNull();
      expect(view.queryResults?.getSelectedResult()?.getID()).toBe('test-id');
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

      it('should query all cameras in live view grid mode', async () => {
        const api = createPopulatedAPI();
        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = createView({
          view: 'live',
          camera: 'camera.office',
          displayMode: 'grid',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view.query).toBeInstanceOf(UnifiedQuery);
        const allCameraIDs = view.query?.getAllCameraIDs();
        expect(allCameraIDs?.size).toBeGreaterThan(1);
      });

      it('should not fetch anything if configured for no thumbnails', async () => {
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
        );

        const view = createView({
          view: 'live',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view.query).toBeNull();
        expect(view.queryResults).toBeNull();
      });

      describe('media type resolution', () => {
        it.each([
          ['snapshots' as const, QueryType.Event],
          ['clips' as const, QueryType.Event],
          ['reviews' as const, QueryType.Review],
        ])(
          'should resolve camera media config to type %s',
          async (mode: 'snapshots' | 'clips' | 'reviews', queryType: QueryType) => {
            const api = createPopulatedAPI();
            const cameraManager = api.getCameraManager();
            if (cameraManager) {
              // Set up camera config with media type using createCameraConfig for defaults
              const store = createStore([
                {
                  cameraID: 'camera.office',
                  capabilities: createCapabilities({ [mode]: true }),
                  config: createCameraConfig({
                    media: {
                      type: mode === 'reviews' ? 'reviews' : 'events',
                      ...(mode === 'clips' || mode === 'snapshots'
                        ? { events_type: mode }
                        : {}),
                    },
                  }),
                },
              ]);
              vi.mocked(cameraManager.getStore).mockReturnValue(store);
              vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
                new Capabilities({ [mode]: true }),
              );
            }

            const viewQueryExecutor = new ViewQueryExecutor(api);
            const view = createView({ view: 'live', camera: 'camera.office' });

            const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
            applyViewModifiers(view, modifiers);

            expect(view.query).toBeDefined();
            const queries = view.query?.getMediaQueries({ type: queryType });
            const query = queries?.[0];
            assert(query);

            if (mode === 'snapshots') {
              assert(isEventQuery(query));
              expect(query.hasSnapshot).toBe(true);
            } else if (mode === 'clips') {
              assert(isEventQuery(query));
              expect(query.hasClip).toBe(true);
            }
          },
        );

        it('should handle folder type by returning null (folders handled separately)', async () => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            const store = createStore([
              {
                cameraID: 'camera.office',
                capabilities: createCapabilities({}),
                config: createCameraConfig({
                  media: {
                    type: 'folder',
                    folders: ['folder-1'],
                  },
                }),
              },
            ]);
            vi.mocked(cameraManager.getStore).mockReturnValue(store);
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          // Folder type returns null and is handled separately
          expect(view.query).toBeNull();
        });
      });

      describe('auto-resolution', () => {
        it('should auto-resolve to reviews if available', async () => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ reviews: true }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getMediaQueries({ type: QueryType.Review });
          expect(queries?.length).toBeGreaterThan(0);
          expect(queries?.[0].cameraIDs.has('camera.office')).toBe(true);
          expect(view.queryResults).toBeDefined();
        });

        it('should auto-resolve to events if clips/snapshots are available', async () => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ clips: true, snapshots: true }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getMediaQueries({ type: QueryType.Event });
          expect(queries?.length).toBeGreaterThan(0);
        });

        it('should auto-resolve to recordings if only recordings is available', async () => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ recordings: true }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          // Recordings-only cameras auto-resolve to recordings
          expect(view.query).toBeDefined();
          const queries = view.query?.getMediaQueries({ type: QueryType.Recording });
          expect(queries?.length).toBeGreaterThan(0);
        });

        it('should auto-resolve to null if no capabilities match', async () => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({}),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

          applyViewModifiers(view, modifiers);
          expect(view.query).toBeNull();
        });

        it('should use events_media_type when camera does not have reviews capability', async () => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ clips: true, reviews: false }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getMediaQueries({ type: QueryType.Event });
          expect(queries?.length).toBeGreaterThan(0);
        });
      });

      describe('when setting or removing seek time', () => {
        it('should set seek time when results are selected based on time', async () => {
          const now = new Date();
          const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI());

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

          expect(view.context).toEqual({
            mediaViewer: {
              seek: now,
            },
          });
        });

        it('should remove seek time when results are not selected based on time', async () => {
          const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI());

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

          expect(view.context?.mediaViewer?.seek).toBeUndefined();
        });
      });

      describe('timeline window', async () => {
        it('should set timeline to now for live views', async () => {
          const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI());
          const view = createView({ view: 'live', camera: 'camera.office' });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view.context).toEqual({
            timeline: {
              window: {
                start: new Date('2024-07-21T12:22:06.000Z'),
                end: new Date('2024-07-21T13:22:06.000Z'),
              },
            },
          });
        });

        it('should unset timeline for non-live views', async () => {
          const viewQueryExecutor = new ViewQueryExecutor(createPopulatedAPI());
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

          expect(view.context).toEqual({ timeline: {} });
        });
      });

      it('should not fetch anything if configured for no thumbnails', async () => {
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
        );

        const view = createView({
          view: 'live',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view.query).toBeNull();
        expect(view.queryResults).toBeNull();
      });
    });

    describe('with a timeline view', () => {
      it('should query all cameras for timeline view', async () => {
        const api = createPopulatedAPI();
        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = createView({
          view: 'timeline',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view.query).toBeInstanceOf(UnifiedQuery);

        // Timeline view should query all cameras, not just the current camera.
        const allCameraIDs = view.query?.getAllCameraIDs();
        expect(allCameraIDs?.size).toBeGreaterThan(1);
      });
    });

    describe('with a media or gallery view', () => {
      it.each(['media' as const, 'gallery' as const])(
        'should set query and queryResults for events with %s view',
        async (viewName) => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ clips: true }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = new View({
            view: viewName,
            camera: 'camera.office',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getMediaQueries({ type: QueryType.Event });
          expect(queries?.length).toBeGreaterThan(0);
          expect(queries?.[0].cameraIDs.has('camera.office')).toBe(true);
          expect(view.queryResults).toBeDefined();
        },
      );

      it.each(['media' as const, 'gallery' as const])(
        'should query all cameras in %s view grid mode',
        async (viewName) => {
          const api = createPopulatedAPI();
          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({
            view: viewName,
            camera: 'camera.office',
            displayMode: 'grid',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const allCameraIDs = view.query?.getAllCameraIDs();
          expect(allCameraIDs?.size).toBeGreaterThan(0);
        },
      );
    });

    describe('with an events-based view', () => {
      it.each([
        'clip' as const,
        'clips' as const,
        'snapshot' as const,
        'snapshots' as const,
      ])('%s', async (viewName: AdvancedCameraCardView) => {
        const api = createPopulatedAPI();
        const cameraManager = api.getCameraManager();
        if (cameraManager) {
          vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
            new Capabilities({ clips: true, snapshots: true }),
          );
        }

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = new View({
          view: viewName,
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

        applyViewModifiers(view, modifiers);

        expect(view.query).toBeInstanceOf(UnifiedQuery);
        const queries = view.query?.getMediaQueries({ type: QueryType.Event });

        expect(queries?.length).toBeGreaterThan(0);
        expect(queries?.[0].cameraIDs.has('camera.office')).toBe(true);
      });

      it('should return empty modifiers when no cameras have capability', async () => {
        const api = createCardAPI();
        const store = createStore([
          {
            cameraID: 'camera.office',

            // No clips/snapshots
            capabilities: createCapabilities({ live: true }),
          },
        ]);
        vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = new View({
          view: 'clips',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

        applyViewModifiers(view, modifiers);

        expect(view.query).toBeNull();
      });

      it('should query all cameras when in grid mode', async () => {
        const api = createPopulatedAPI();

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = new View({
          view: 'clips',
          camera: 'camera.office',
          displayMode: 'grid',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

        applyViewModifiers(view, modifiers);

        expect(view.query).toBeInstanceOf(UnifiedQuery);

        const allCameraIDs = view.query?.getAllCameraIDs();
        expect(allCameraIDs?.size).toBeGreaterThan(0);
      });

      it('should apply media_chunk_size to query limit', async () => {
        const api = createCardAPI();
        const store = createStore([
          {
            cameraID: 'camera.office',
            capabilities: createCapabilities({ clips: true }),
          },
        ]);
        vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue({
          ...createConfig(),
          performance: createPerformanceConfig({
            features: {
              media_chunk_size: 42,
            },
          }),
        });

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = new View({
          view: 'clips',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

        applyViewModifiers(view, modifiers);

        expect(view.query).toBeInstanceOf(UnifiedQuery);
        const queries = view.query?.getMediaQueries({ type: QueryType.Event });
        expect(queries?.length).toBeGreaterThan(0);
        expect(queries?.[0].limit).toBe(42);
      });

      it('should use default chunk size when config is missing', async () => {
        const api = createCardAPI();
        const store = createStore([
          {
            cameraID: 'camera.office',
            capabilities: createCapabilities({ clips: true }),
          },
        ]);
        vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));

        vi.mocked(api.getConfigManager().getConfig).mockReturnValue({
          ...createConfig(),
          performance: undefined as unknown as PerformanceConfig,
        });

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = new View({
          view: 'clips',
          camera: 'camera.office',
        });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

        applyViewModifiers(view, modifiers);

        // Should use default limit (MEDIA_CHUNK_SIZE_DEFAULT = 50)
        expect(view.query).toBeInstanceOf(UnifiedQuery);
        const queries = view.query?.getMediaQueries({ type: QueryType.Event });
        expect(queries?.length).toBeGreaterThan(0);
        expect(queries?.[0].limit).toBe(50);
      });
    });

    describe('with a recordings-based view', () => {
      it.each([['recording' as const], ['recordings' as const]])(
        '%s',
        async (viewName: AdvancedCameraCardView) => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue([]);
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ recordings: true }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = new View({
            view: viewName,
            camera: 'camera.office',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getMediaQueries({ type: QueryType.Recording });
          expect(queries?.length).toBeGreaterThan(0);
          expect(queries?.[0].cameraIDs.has('camera.office')).toBe(true);
          expect(view.queryResults).toBeDefined();
        },
      );
    });

    describe('with a folder view', () => {
      it.each([['folder' as const], ['folders' as const]])(
        'should execute default folder query with %s view',
        async (viewName: AdvancedCameraCardView) => {
          const api = createPopulatedAPI();
          vi.mocked(api.getFoldersManager().getFolder).mockReturnValue({
            type: 'ha',
            id: 'office',
            title: 'Office',
          });
          vi.mocked(api.getFoldersManager().getDefaultQueryParameters).mockReturnValue({
            source: QuerySource.Folder,
            folder: { type: 'ha', id: 'office', title: 'Office' },
            path: [{ ha: { id: 'media-source://' } }],
          });

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = createView({
            view: viewName,
            camera: 'camera.office',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getFolderQueries();
          expect(queries?.length).toBeGreaterThan(0);
        },
      );

      it('should execute default folder query with folder view and handle null results', async () => {
        const api = createPopulatedAPI();
        vi.mocked(api.getFoldersManager().getFolder).mockReturnValue(null);
        vi.mocked(api.getFoldersManager().getDefaultQueryParameters).mockReturnValue(
          null,
        );

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = createView({ view: 'folder', camera: 'camera.office' });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);

        applyViewModifiers(view, modifiers);

        expect(view.query).toBeNull();
      });

      it('should return empty when getDefaultQueryParameters returns null', async () => {
        const api = createPopulatedAPI();
        vi.mocked(api.getFoldersManager().getFolder).mockReturnValue({
          type: 'ha',
          id: 'office',
          title: 'Office',
        });
        vi.mocked(api.getFoldersManager().getDefaultQueryParameters).mockReturnValue(
          null,
        );

        const viewQueryExecutor = new ViewQueryExecutor(api);
        const view = createView({ view: 'folder', camera: 'camera.office' });

        const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
        applyViewModifiers(view, modifiers);

        expect(view.query).toBeNull();
      });
    });

    describe('with a reviews-based view', () => {
      it.each([['review' as const], ['reviews' as const]])(
        '%s',
        async (viewName: AdvancedCameraCardView) => {
          const api = createPopulatedAPI();
          const cameraManager = api.getCameraManager();
          if (cameraManager) {
            vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue(
              new Capabilities({ reviews: true }),
            );
          }

          const viewQueryExecutor = new ViewQueryExecutor(api);
          const view = new View({
            view: viewName,
            camera: 'camera.office',
          });

          const modifiers = await viewQueryExecutor.getNewQueryModifiers(view);
          applyViewModifiers(view, modifiers);

          expect(view.query).toBeInstanceOf(UnifiedQuery);
          const queries = view.query?.getMediaQueries({ type: QueryType.Review });
          expect(queries?.length).toBeGreaterThan(0);
          expect(queries?.[0].cameraIDs.has('camera.office')).toBe(true);
          expect(view.queryResults).toBeDefined();
        },
      );
    });
  });
});
