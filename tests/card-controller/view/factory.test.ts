import { describe, expect, it, vi } from 'vitest';
import { ViewFactory } from '../../../src/card-controller/view/factory';
import { ViewModifier } from '../../../src/card-controller/view/types';
import { AdvancedCameraCardView } from '../../../src/config/schema/common/const';
import { ViewDisplayMode } from '../../../src/config/schema/common/display';
import { View } from '../../../src/view/view';
import {
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createStore,
  createView,
} from '../../test-utils';
import { createPopulatedAPI } from './test-utils';

describe('getViewDefault', () => {
  it('should return null without config', () => {
    const factory = new ViewFactory(createCardAPI());
    expect(factory.getViewDefault()).toBeNull();
  });

  it('should throw if no cameras support view', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());

    // No cameras support live.
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({
            live: false,
          }),
        },
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            live: false,
          }),
        },
      ]),
    );

    const factory = new ViewFactory(api);
    expect(() => factory.getViewDefault()).toThrowError(/No cameras support this view/);
  });

  it('should create view', () => {
    const factory = new ViewFactory(createPopulatedAPI());
    const view = factory.getViewDefault();

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.office');
  });

  it('should cycle camera when configured', () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          default_cycle_camera: true,
        },
      }),
    );

    const factory = new ViewFactory(api);

    let view = factory.getViewDefault();
    expect(view?.camera).toBe('camera.office');

    view = factory.getViewDefault({ baseView: view });
    expect(view?.camera).toBe('camera.kitchen');

    view = factory.getViewDefault({ baseView: view });
    expect(view?.camera).toBe('camera.office');

    // When a parameter is specified, it will not cycle.
    view = factory.getViewDefault({
      params: { camera: 'camera.office' },
      baseView: view,
    });
    expect(view?.camera).toBe('camera.office');
  });

  it('should use default camera when camera unspecified', () => {
    // Even though baseView has a camera, since default is called it should
    // use that camera.

    const factory = new ViewFactory(createPopulatedAPI());
    const baseView = createView({ camera: 'camera.kitchen' });
    const view = factory.getViewDefault({
      baseView: baseView,
    });

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.office');
  });

  it('should respect parameters', () => {
    const factory = new ViewFactory(createPopulatedAPI());
    const view = factory.getViewDefault({
      params: {
        camera: 'camera.kitchen',
      },
    });

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.kitchen');
  });
});

describe('getViewByParameters', () => {
  it('should get view by parameters specifying camera and view', () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
      createCapabilities({
        clips: true,
      }),
    );

    const factory = new ViewFactory(api);
    const view = factory.getViewByParameters({
      params: {
        camera: 'camera.kitchen',
        view: 'clips',
      },
    });

    expect(view?.is('clips')).toBeTruthy();
    expect(view?.camera).toBe('camera.kitchen');
  });

  it('should get view by parameters using base view if unspecified', () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
      createCapabilities({
        clips: true,
      }),
    );

    const factory = new ViewFactory(api);
    const baseView = new View({
      camera: 'camera.kitchen',
      view: 'clips',
    });

    const view = factory.getViewByParameters({
      baseView: baseView,
      params: {
        camera: 'camera.office',
      },
    });

    expect(view?.view).toBe('clips');
    expect(view?.camera).toBe('camera.office');
  });

  it('should set view by parameters using config as fallback', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

    const factory = new ViewFactory(api);
    const view = factory.getViewByParameters({
      params: {
        camera: 'camera.kitchen',

        // No prior view, and no specified view. This could happen during query
        // string based initialization.
      },
    });

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.kitchen');
  });

  it('should not set view by parameters without config', () => {
    const factory = new ViewFactory(createCardAPI());

    const view = factory.getViewByParameters({
      params: {
        view: 'live',
      },
    });

    expect(view).toBeNull();
  });

  it('should throw without camera and without failsafe', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({ snapshots: false }),
        },
        {
          cameraID: 'camera.office',
          // No capabilities.
          capabilities: null,
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

    const factory = new ViewFactory(api);
    expect(() =>
      factory.getViewByParameters({
        // Since no camera is specified, and no camera supports the capabilities
        // necessary for this view, the view will be null.
        params: {
          view: 'snapshots',
        },
      }),
    ).toThrowError(/No cameras support this view/);
  });

  describe('should handle unsupported view', () => {
    it('should throw without failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ snapshots: false }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          snapshots: false,
        }),
      );

      const factory = new ViewFactory(api);
      expect(() =>
        factory.getViewByParameters({
          params: {
            camera: 'camera.kitchen',
            view: 'snapshots',
          },
        }),
      ).toThrowError(/The selected camera does not support this view/);
    });

    it('should choose live view with failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ live: true, snapshots: false }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          live: true,
          snapshots: false,
        }),
      );

      const factory = new ViewFactory(api);
      const view = factory.getViewByParameters({
        params: {
          camera: 'camera.kitchen',
          view: 'snapshots',
        },
        failSafe: true,
      });
      expect(view?.is('live')).toBeTruthy();
    });
  });

  it('should call modifiers', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

    const modifyCallback = vi.fn();
    class TestViewModifier implements ViewModifier {
      modify = modifyCallback;
    }

    const view = new View({
      view: 'live',
      camera: 'camera.office',
    });
    const factory = new ViewFactory(api);
    const modifiedView = factory.getViewByParameters({
      baseView: view,
      modifiers: [new TestViewModifier()],
    });

    expect(modifiedView?.is('live')).toBeTruthy();
    expect(modifiedView?.camera).toBe('camera.office');
    expect(view).not.toBe(modifiedView);
    expect(modifyCallback).toHaveBeenCalledWith(modifiedView);
  });

  describe('should get correct display mode', () => {
    it('should use config display mode when changing views', () => {
      const api = createPopulatedAPI({
        media_viewer: {
          display: { mode: 'single' },
        },
      });

      const factory = new ViewFactory(api);
      expect(
        factory.getViewByParameters({
          params: {
            view: 'clip',
            displayMode: 'grid',
          },
        })?.displayMode,
      ).toBe('single');
    });

    it('should ignore config display mode with a view', () => {
      const api = createPopulatedAPI({
        media_viewer: {
          display: { mode: 'single' },
        },
      });

      const baseView = createView({
        view: 'live',
      });

      const factory = new ViewFactory(api);
      expect(
        factory.getViewByParameters({
          baseView: baseView,
          params: {
            view: 'live',
            displayMode: 'grid',
          },
        })?.displayMode,
      ).toBe('grid');
    });

    describe('should get correct default display mode', () => {
      describe.each([
        ['single' as const, { mode: 'single' as const }],
        ['grid' as const, { mode: 'grid' as const }],
        ['single' as const, undefined],
      ])('%s', (expectedDisplayMode: ViewDisplayMode, displayConfig?: unknown) => {
        it.each([
          ['media' as const],
          ['clip' as const],
          ['recording' as const],
          ['snapshot' as const],
          ['live' as const],
        ])('%s', (viewName: AdvancedCameraCardView) => {
          const api = createPopulatedAPI({
            media_viewer: {
              display: displayConfig,
            },
            live: {
              display: displayConfig,
            },
          });

          const factory = new ViewFactory(api);
          expect(
            factory.getViewByParameters({
              params: {
                view: viewName,
              },
            })?.displayMode,
          ).toBe(expectedDisplayMode);
        });
      });
    });
  });
});
