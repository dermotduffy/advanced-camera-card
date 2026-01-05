import { ViewContext } from 'view';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../../src/card-controller/controller';
import { ViewFactory } from '../../../src/card-controller/view/factory';
import { SetQueryViewModifier } from '../../../src/card-controller/view/modifiers/set-query';
import {
  QueryExecutorOptions,
  ViewModifier,
} from '../../../src/card-controller/view/types';
import { ViewManager } from '../../../src/card-controller/view/view-manager';
import { ViewQueryExecutor } from '../../../src/card-controller/view/view-query-executor';
import { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import { ViewMedia, ViewMediaType } from '../../../src/view/item';
import { QueryResults } from '../../../src/view/query-results';
import { UnifiedQuery } from '../../../src/view/unified-query';
import { View } from '../../../src/view/view';
import { createCardAPI, createEventQuery, createView } from '../../test-utils';

const createInitializedCardAPI = (initialized?: boolean): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getInitializationManager().isInitialized).mockReturnValue(
    initialized ?? true,
  );
  return api;
};

describe('should act correctly when view is set', () => {
  it('basic view', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
      displayMode: 'grid',
    });

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(view);

    const api = createInitializedCardAPI();
    const manager = new ViewManager(api, { viewFactory: factory });

    manager.setViewDefault();

    expect(manager.getView()).toBe(view);
    expect(manager.hasView()).toBeTruthy();
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getCardElementManager().scrollReset).toBeCalled();
    expect(api.getMessageManager().reset).toBeCalled();
    expect(api.getStyleManager().setExpandedMode).toBeCalled();
    expect(api.getConditionStateManager()?.setState).toBeCalledWith({
      view: 'live',
      camera: 'camera',
      displayMode: 'grid',
    });
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('view with minor changes without media clearing or scroll', () => {
    const view_1 = createView({
      view: 'live',
      camera: 'camera',
    });
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(view_1);

    const api = createInitializedCardAPI();
    const manager = new ViewManager(api, { viewFactory: factory });

    manager.setViewDefault();

    vi.mocked(api.getMediaLoadedInfoManager().clear).mockClear();
    vi.mocked(api.getCardElementManager().scrollReset).mockClear();

    const view_2 = createView({
      view: 'live',
      camera: 'camera',
      displayMode: 'single',
    });
    factory.getViewDefault.mockReturnValue(view_2);

    manager.setViewDefault();

    expect(manager.getView()).toBe(view_2);

    // The new view is neither a major media change, nor a different view name,
    // so media clearing and scrolling should not happen.
    expect(api.getMediaLoadedInfoManager().clear).not.toBeCalled();
    expect(api.getCardElementManager().scrollReset).not.toBeCalled();
  });
});

it('setViewWithMergedContext', () => {
  const api = createInitializedCardAPI();
  const factory = mock<ViewFactory>();

  const manager = new ViewManager(api, { viewFactory: factory });
  const context: ViewContext = { timeline: {} };

  // Setting context with no existing view does nothing.
  manager.setViewWithMergedContext(context);
  expect(manager.getView()).toBeNull();

  const view = createView({
    view: 'live',
    camera: 'camera',
  });
  factory.getViewDefault.mockReturnValue(view);
  manager.setViewDefault();
  manager.setViewWithMergedContext(context);

  expect(manager.getView()?.camera).toBe('camera');
  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.context).toEqual(context);
});

it('getEpoch', () => {
  const factory = mock<ViewFactory>();
  const manager = new ViewManager(createCardAPI(), { viewFactory: factory });
  expect(manager.getEpoch()).toBeTruthy();
  expect(manager.getEpoch().manager).toBe(manager);
});

it('reset', () => {
  const factory = mock<ViewFactory>();
  const manager = new ViewManager(createInitializedCardAPI(), { viewFactory: factory });

  manager.reset();
  expect(manager.getView()).toBeNull();
  expect(manager.hasView()).toBeFalsy();

  factory.getViewDefault.mockReturnValue(createView());
  manager.setViewDefault();

  expect(manager.getView()).not.toBeNull();
  expect(manager.hasView()).toBeTruthy();

  manager.reset();

  expect(manager.getView()).toBeNull();
  expect(manager.hasView()).toBeFalsy();
});

describe('should not set view without cameras being initialized', () => {
  it('should ignore requests to set generic view without cameras being initialized', () => {
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView());

    const manager = new ViewManager(createInitializedCardAPI(false), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(manager.getView()).toBeNull();
  });

  it('should ignore requests to set view then modify without cameras being initialized', () => {
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView());

    const manager = new ViewManager(createInitializedCardAPI(false), {
      viewFactory: factory,
    });
    manager.setViewDefaultWithNewQuery();

    expect(manager.getView()).toBeNull();
  });
});

it('setViewDefault', () => {
  const factory = mock<ViewFactory>();
  factory.getViewDefault.mockReturnValue(createView());

  const manager = new ViewManager(createInitializedCardAPI(), { viewFactory: factory });
  manager.setViewDefault();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewByParameters', () => {
  const factory = mock<ViewFactory>();
  factory.getViewByParameters.mockReturnValue(createView());

  const manager = new ViewManager(createInitializedCardAPI(), { viewFactory: factory });
  manager.setViewByParameters();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewDefaultWithNewQuery', async () => {
  const viewFactory = mock<ViewFactory>();
  viewFactory.getViewDefault.mockReturnValue(createView());

  const viewQueryExecutor = mock<ViewQueryExecutor>();
  viewQueryExecutor.getNewQueryModifiers.mockResolvedValue([]);

  const manager = new ViewManager(createInitializedCardAPI(), {
    viewFactory: viewFactory,
    viewQueryExecutor: viewQueryExecutor,
  });
  await manager.setViewDefaultWithNewQuery();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewByParametersWithNewQuery', async () => {
  const viewFactory = mock<ViewFactory>();
  viewFactory.getViewByParameters.mockReturnValue(createView());

  const viewQueryExecutor = mock<ViewQueryExecutor>();
  viewQueryExecutor.getNewQueryModifiers.mockResolvedValue([]);

  const manager = new ViewManager(createInitializedCardAPI(), {
    viewFactory: viewFactory,
    viewQueryExecutor: viewQueryExecutor,
  });
  await manager.setViewByParametersWithNewQuery();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewByParametersWithExistingQuery', async () => {
  const viewFactory = mock<ViewFactory>();
  viewFactory.getViewByParameters.mockReturnValue(createView());

  const viewQueryExecutor = mock<ViewQueryExecutor>();
  viewQueryExecutor.getNewQueryModifiers.mockResolvedValue([]);

  const manager = new ViewManager(createInitializedCardAPI(), {
    viewFactory: viewFactory,
    viewQueryExecutor: viewQueryExecutor,
  });

  await manager.setViewByParametersWithExistingQuery();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

describe('should handle exceptions', () => {
  it('should handle exceptions in sync calls', () => {
    const error = new Error();
    const viewFactory = mock<ViewFactory>();
    viewFactory.getViewDefault.mockImplementation(() => {
      throw error;
    });

    const api = createInitializedCardAPI();
    const manager = new ViewManager(api, { viewFactory: viewFactory });
    manager.setViewDefault();

    expect(manager.hasView()).toBeFalsy();
    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });

  it('should handle viewFactory exceptions in async calls', async () => {
    const error = new Error();
    const viewFactory = mock<ViewFactory>();
    viewFactory.getViewDefault.mockImplementation(() => {
      throw error;
    });

    const api = createInitializedCardAPI();
    const manager = new ViewManager(api, { viewFactory: viewFactory });
    await manager.setViewDefaultWithNewQuery();

    expect(manager.hasView()).toBeFalsy();
    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });

  it('should handle viewQueryExecutor exceptions in async calls', async () => {
    const error = new Error();
    const viewFactory = mock<ViewFactory>();
    viewFactory.getViewDefault.mockReturnValue(createView());
    const viewQueryExecutor = mock<ViewQueryExecutor>();
    viewQueryExecutor.getNewQueryModifiers.mockRejectedValue(error);

    const api = createInitializedCardAPI();
    const manager = new ViewManager(api, {
      viewFactory: viewFactory,
      viewQueryExecutor: viewQueryExecutor,
    });

    await manager.setViewDefaultWithNewQuery();

    // The initial view will have been set.
    expect(manager.hasView()).toBeTruthy();

    // But an error will also be generated.
    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });
});

describe('hasMajorMediaChange', () => {
  it('should consider undefined views as major', () => {
    const manager = new ViewManager(createCardAPI());

    expect(manager.hasMajorMediaChange(undefined)).toBeFalsy();
    expect(manager.hasMajorMediaChange(createView())).toBeTruthy();
    expect(manager.hasMajorMediaChange()).toBeFalsy();
  });

  it('should consider view change as major', () => {
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView({ view: 'live' }));

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(manager.hasMajorMediaChange(createView({ view: 'clips' }))).toBeTruthy();
  });

  it('should consider camera change as major', () => {
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView({ camera: 'camera-1' }));

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(manager.hasMajorMediaChange(createView({ camera: 'camera-2' }))).toBeTruthy();
  });

  it('should consider live substream change as major in live view', () => {
    const overrides_1: Map<string, string> = new Map();
    overrides_1.set('camera', 'camera-2');

    const overrides_2: Map<string, string> = new Map();
    overrides_2.set('camera', 'camera-3');

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(
      createView({ context: { live: { overrides: overrides_1 } } }),
    );

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(
        createView({ context: { live: { overrides: overrides_2 } } }),
      ),
    ).toBeTruthy();
  });

  it('should not consider live substream change as major in other view', () => {
    const overrides_1: Map<string, string> = new Map();
    overrides_1.set('camera', 'camera-2');

    const overrides_2: Map<string, string> = new Map();
    overrides_2.set('camera', 'camera-3');

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(
      createView({ view: 'clips', context: { live: { overrides: overrides_1 } } }),
    );

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(
        createView({ view: 'clips', context: { live: { overrides: overrides_2 } } }),
      ),
    ).toBeFalsy();
  });

  it('should consider result change as major in other view', () => {
    const media = [
      new ViewMedia(ViewMediaType.Clip, {
        cameraID: 'camera-1',
      }),
      new ViewMedia(ViewMediaType.Clip, {
        cameraID: 'camera-2',
      }),
    ];
    const queryResults_1 = new QueryResults({ results: media, selectedIndex: 0 });
    const queryResults_2 = new QueryResults({ results: media, selectedIndex: 1 });

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(
      createView({ view: 'media', queryResults: queryResults_1 }),
    );

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(
        createView({ view: 'media', queryResults: queryResults_2 }),
      ),
    ).toBeTruthy();
  });

  it('should not consider selected result change as major in live view', () => {
    const media = [
      new ViewMedia(ViewMediaType.Clip, {
        cameraID: 'camera-1',
      }),
      new ViewMedia(ViewMediaType.Clip, {
        cameraID: 'camera-2',
      }),
    ];
    const queryResults_1 = new QueryResults({ results: media, selectedIndex: 0 });
    const queryResults_2 = new QueryResults({ results: media, selectedIndex: 1 });

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView({ queryResults: queryResults_1 }));

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: factory,
    });
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(createView({ queryResults: queryResults_2 })),
    ).toBeFalsy();
  });
});

describe('should initialize', () => {
  it('without querystring', async () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
    });

    const viewFactory = mock<ViewFactory>();
    viewFactory.getViewDefault.mockReturnValue(view);

    const api = createInitializedCardAPI();
    const manager = new ViewManager(api, {
      viewFactory: viewFactory,
    });

    expect(await manager.initialize()).toBeTruthy();

    expect(manager.getView()).toBe(view);
  });

  it('with querystring', async () => {
    const api = createCardAPI();
    const factory = mock<ViewFactory>();
    const manager = new ViewManager(api, { viewFactory: factory });
    vi.mocked(api.getQueryStringManager().hasViewRelatedActionsToRun).mockReturnValue(
      true,
    );

    expect(await manager.initialize()).toBeTruthy();

    expect(manager.hasView()).toBeFalsy();
  });
});

describe('should apply async view modifications', () => {
  it('should apply modifications successfully', async () => {
    const viewFactory = mock<ViewFactory>();
    viewFactory.getViewDefault.mockReturnValue(createView({ view: 'live' }));

    const query = new UnifiedQuery();
    const queryResults = new QueryResults();

    const viewQueryExecutor = mock<ViewQueryExecutor>();
    viewQueryExecutor.getNewQueryModifiers.mockResolvedValue([
      new SetQueryViewModifier({
        query: query,
        queryResults: queryResults,
      }),
    ]);

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: viewFactory,
      viewQueryExecutor: viewQueryExecutor,
    });

    await manager.setViewDefaultWithNewQuery();

    expect(manager.getView()?.query).toBe(query);
    expect(manager.getView()?.queryResults).toBe(queryResults);
    expect(manager.getView()?.context?.loading?.query).toBeUndefined();
  });

  it('should not apply modifications if there is a major media change', async () => {
    const viewFactory = mock<ViewFactory>();
    viewFactory.getViewDefault.mockReturnValueOnce(createView({ view: 'live' }));

    const query = new UnifiedQuery();
    const queryResults = new QueryResults();

    const viewQueryExecutor = mock<ViewQueryExecutor>();

    const manager = new ViewManager(createInitializedCardAPI(), {
      viewFactory: viewFactory,
      viewQueryExecutor: viewQueryExecutor,
    });

    viewQueryExecutor.getNewQueryModifiers.mockImplementation(
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _view: View,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _executorqueryExecutorOptions?: QueryExecutorOptions,
      ): Promise<ViewModifier[] | null> => {
        // Simulate a major media change while the async operation is running.
        viewFactory.getViewDefault.mockReturnValueOnce(
          createView({ view: 'clips', context: { loading: { query: 1 } } }),
        );
        manager.setViewDefault();

        // Now return the modifiers (which should be ignored since there has
        // been a major change in the meantime).
        return [
          new SetQueryViewModifier({
            query: query,
            queryResults: queryResults,
          }),
        ];
      },
    );

    await manager.setViewDefaultWithNewQuery();

    // View set during the async operation should not be touched.
    expect(manager.getView()?.is('clips')).toBeTruthy();
    expect(manager.getView()?.query).toBeNull();
    expect(manager.getView()?.queryResults).toBeNull();
    expect(manager.getView()?.context?.loading?.query).toBeUndefined();
  });

  describe('should manage loading state correctly', () => {
    it('should mark as not loading when with major media change', async () => {
      const viewFactory = mock<ViewFactory>();
      viewFactory.getViewDefault.mockReturnValueOnce(createView({ view: 'live' }));
      const viewQueryExecutor = mock<ViewQueryExecutor>();

      const manager = new ViewManager(createInitializedCardAPI(), {
        viewFactory: viewFactory,
        viewQueryExecutor: viewQueryExecutor,
      });

      viewQueryExecutor.getNewQueryModifiers.mockImplementation(
        async (
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _view: View,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _executorqueryExecutorOptions?: QueryExecutorOptions,
        ): Promise<ViewModifier[] | null> => {
          expect(manager.getView()?.context?.loading?.query).not.toBeUndefined();

          // Simulate a major media change while the async operation is running.
          viewFactory.getViewDefault.mockReturnValueOnce(
            createView({ view: 'clips', context: { loading: { query: 1 } } }),
          );
          manager.setViewDefault();

          // Now return the modifiers (which should be ignored since there has
          // been a major change in the meantime).
          return [];
        },
      );

      await manager.setViewDefaultWithNewQuery();

      expect(manager.getView()?.context?.loading?.query).toBeUndefined();
    });

    it('should not change loading status if something else is being loaded', async () => {
      const viewFactory = mock<ViewFactory>();
      viewFactory.getViewDefault.mockReturnValueOnce(createView({ view: 'live' }));
      const viewQueryExecutor = mock<ViewQueryExecutor>();

      const manager = new ViewManager(createInitializedCardAPI(), {
        viewFactory: viewFactory,
        viewQueryExecutor: viewQueryExecutor,
      });

      viewQueryExecutor.getNewQueryModifiers.mockImplementation(
        async (
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _view: View,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _executorqueryExecutorOptions?: QueryExecutorOptions,
        ): Promise<ViewModifier[] | null> => {
          expect(manager.getView()?.context?.loading?.query).not.toBeUndefined();

          // Simulate a major media change while the async operation is running.
          viewFactory.getViewDefault.mockReturnValueOnce(
            createView({ view: 'clips', context: { loading: { query: 2 } } }),
          );
          manager.setViewDefault();

          // Now return the modifiers (which should be ignored since there has
          // been a major change in the meantime).
          return [];
        },
      );

      await manager.setViewDefaultWithNewQuery();

      expect(manager.getView()?.context?.loading?.query).toBe(2);
    });

    it('should not change loading status if it is unexpected', async () => {
      const viewFactory = mock<ViewFactory>();
      viewFactory.getViewDefault.mockReturnValueOnce(createView({ view: 'live' }));
      const viewQueryExecutor = mock<ViewQueryExecutor>();

      const manager = new ViewManager(createInitializedCardAPI(), {
        viewFactory: viewFactory,
        viewQueryExecutor: viewQueryExecutor,
      });

      viewQueryExecutor.getNewQueryModifiers.mockImplementation(
        async (
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _view: View,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _executorqueryExecutorOptions?: QueryExecutorOptions,
        ): Promise<ViewModifier[] | null> => {
          expect(manager.getView()?.context?.loading?.query).not.toBeUndefined();

          // Simulate another view update (without a major media change)
          viewFactory.getViewDefault.mockReturnValueOnce(
            createView({ context: { loading: { query: 100 } } }),
          );
          manager.setViewDefault();

          // Now return the modifiers (which should be ignored since there has
          // been a major change in the meantime).
          return [];
        },
      );

      await manager.setViewDefaultWithNewQuery();

      expect(manager.getView()?.context?.loading?.query).toBe(100);
    });
  });

  describe('should adopt query results when useful', () => {
    const testAdoption = async (
      originView: AdvancedCameraCardView | undefined,
      targetViewName: AdvancedCameraCardView,
      startViewName: AdvancedCameraCardView = 'media',
    ): Promise<boolean> => {
      const startView = createView({
        view: startViewName,
        camera: 'camera',
        query: new UnifiedQuery([createEventQuery('c1')]),
        queryResults: new QueryResults(),
        context: originView ? { gallery: { originView } } : undefined,
      });
      const targetView = createView({
        view: targetViewName,
        camera: 'camera',
      });

      const viewFactory = mock<ViewFactory>();
      viewFactory.getViewDefault
        .mockReturnValueOnce(startView)
        .mockReturnValueOnce(targetView);

      const viewQueryExecutor = mock<ViewQueryExecutor>();
      viewQueryExecutor.getNewQueryModifiers.mockResolvedValue([]);

      const manager = new ViewManager(createInitializedCardAPI(), {
        viewFactory: viewFactory,
        viewQueryExecutor: viewQueryExecutor,
      });

      manager.setViewDefault();
      await manager.setViewDefaultWithNewQuery();

      return vi.mocked(viewQueryExecutor.getNewQueryModifiers).mock.calls.length === 0;
    };

    it('should return false when no originView context', async () => {
      expect(await testAdoption(undefined, 'clips')).toBe(false);
    });

    it('should return true when originView matches target', async () => {
      expect(await testAdoption('clips', 'clips')).toBe(true);
      expect(await testAdoption('snapshots', 'snapshots')).toBe(true);
      expect(await testAdoption('recordings', 'recordings')).toBe(true);
      expect(await testAdoption('reviews', 'reviews')).toBe(true);
    });

    it('should return false when originView does not match target', async () => {
      expect(await testAdoption('clips', 'snapshots')).toBe(false);
      expect(await testAdoption('clips', 'recordings')).toBe(false);
      expect(await testAdoption('snapshots', 'clips')).toBe(false);
      expect(await testAdoption('recordings', 'reviews')).toBe(false);
    });

    it('should return false when start view is not viewer', async () => {
      expect(await testAdoption('clips', 'clips', 'live')).toBe(false);
    });

    it('should return false when target view is not gallery', async () => {
      expect(await testAdoption('clips', 'live')).toBe(false);
    });
  });
});
