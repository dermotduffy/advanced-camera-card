import { describe, expect, it, vi } from 'vitest';

import { CameraManagerStore } from '../../../../src/camera-manager/store';
import { SubstreamOnAction } from '../../../../src/card-controller/actions/actions/substream-on';
import { applyViewModifiers } from '../../../../src/card-controller/view/modifiers';
import { createSubstreamOnAction } from '../../../../src/utils/action';
import { getStreamCameraID } from '../../../../src/view/substream';
import { View } from '../../../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createStore,
  createView,
} from '../../../test-utils';

// A store where `camera.office` has one substream dependency, `camera.kitchen`.
const createStoreWithSubstreams = (): CameraManagerStore =>
  createStore([
    {
      cameraID: 'camera.office',
      capabilities: createCapabilities({ live: true, substream: true }),
      config: createCameraConfig({ dependencies: { all_cameras: true } }),
    },
    {
      cameraID: 'camera.kitchen',
      capabilities: createCapabilities({ substream: true }),
    },
  ]);

// Runs the on-action for `view`, applies the modifier it produces (via the real
// `applyViewModifiers`), and returns the engaged stream for the override key
// the modifier wrote (`camera` if set, otherwise the selected camera).
const applySubstreamOn = async (
  view: View,
  options?: {
    store?: CameraManagerStore;
    camera?: string;
    stream?: string;
  },
): Promise<string | null> => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(view);
  vi.mocked(api.getCameraManager).mockReturnValue(
    createCameraManager(options?.store ?? createStoreWithSubstreams()),
  );

  await new SubstreamOnAction(
    {},
    createSubstreamOnAction({
      camera: options?.camera,
      stream: options?.stream,
    }),
  ).execute(api);

  const params = vi.mocked(api.getViewManager().setViewByParameters).mock.calls[0]?.[0];
  applyViewModifiers(view, params?.modifiers);
  return getStreamCameraID(view, options?.camera);
};

describe('SubstreamOnAction', () => {
  describe('cycling (no `stream` parameter)', () => {
    it('should advance to the next dependency', async () => {
      expect(
        await applySubstreamOn(createView({ view: 'live', camera: 'camera.office' })),
      ).toBe('camera.kitchen');
    });

    it('should wrap back to the parent camera', async () => {
      const view = createView({
        view: 'live',
        camera: 'camera.office',
        context: {
          live: { overrides: new Map([['camera.office', 'camera.kitchen']]) },
        },
      });

      expect(await applySubstreamOn(view)).toBe('camera.office');
    });

    it('should treat a malformed override as the start of the cycle', async () => {
      const view = createView({
        view: 'live',
        camera: 'camera.office',
        context: {
          live: { overrides: new Map([['camera.office', 'NOT_A_REAL_CAMERA']]) },
        },
      });

      expect(await applySubstreamOn(view)).toBe('camera.office');
    });

    it('should engage no substream when there are no usable dependencies', async () => {
      const view = createView({ view: 'live', camera: 'camera.office' });

      expect(await applySubstreamOn(view, { store: createStore() })).toBe(
        'camera.office',
      );
    });
  });

  describe('with an explicit `stream`', () => {
    it('should engage that stream on the selected camera', async () => {
      expect(
        await applySubstreamOn(createView({ view: 'live', camera: 'camera.office' }), {
          stream: 'camera.kitchen',
        }),
      ).toBe('camera.kitchen');
    });

    it('should treat `stream` equal to the camera as no substream', async () => {
      // Already cycled to a substream; passing the parent camera as `stream`
      // should be equivalent to off.
      const view = createView({
        view: 'live',
        camera: 'camera.office',
        context: {
          live: { overrides: new Map([['camera.office', 'camera.kitchen']]) },
        },
      });

      expect(await applySubstreamOn(view, { stream: 'camera.office' })).toBe(
        'camera.office',
      );
    });
  });

  describe('with an explicit `camera`', () => {
    it('should target that camera instead of the selected one', async () => {
      const view = createView({ view: 'live', camera: 'camera.driveway' });

      expect(
        await applySubstreamOn(view, {
          camera: 'camera.office',
          stream: 'camera.kitchen',
        }),
      ).toBe('camera.kitchen');
    });

    it('should cycle dependencies of the explicit camera', async () => {
      const view = createView({ view: 'live', camera: 'camera.driveway' });

      expect(await applySubstreamOn(view, { camera: 'camera.office' })).toBe(
        'camera.kitchen',
      );
    });

    it('should engage no substream when the explicit camera has no dependencies', async () => {
      const view = createView({
        view: 'live',
        camera: 'camera.driveway',
        context: {
          live: { overrides: new Map([['camera.no_deps', 'camera.stale']]) },
        },
      });

      expect(
        await applySubstreamOn(view, {
          camera: 'camera.no_deps',
          store: createStore([
            {
              cameraID: 'camera.no_deps',
              capabilities: createCapabilities({ substream: true }),
            },
          ]),
        }),
      ).toBe('camera.no_deps');
    });
  });

  it('should engage no substream when the view has no camera and the action has no camera', async () => {
    expect(
      await applySubstreamOn(createView({ view: 'live', camera: null })),
    ).toBeNull();
  });

  it('should do nothing without a view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    await new SubstreamOnAction({}, createSubstreamOnAction()).execute(api);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });
});
