import { describe, expect, it, vi } from 'vitest';
import { CameraManagerStore } from '../../../../src/camera-manager/store';
import { SubstreamOnAction } from '../../../../src/card-controller/actions/actions/substream-on';
import { applyViewModifiers } from '../../../../src/card-controller/view/modifiers';
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

const createAction = (): SubstreamOnAction =>
  new SubstreamOnAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'live_substream_on',
    },
  );

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
// `applyViewModifiers`), and returns the resulting engaged stream.
const getStreamAfterSubstreamOn = async (
  view: View,
  store: CameraManagerStore = createStoreWithSubstreams(),
): Promise<string | null> => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(view);
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));

  await createAction().execute(api);

  const params = vi.mocked(api.getViewManager().setViewByParameters).mock.calls[0]?.[0];
  applyViewModifiers(view, params?.modifiers);
  return getStreamCameraID(view);
};

describe('SubstreamOnAction', () => {
  it('should advance to the next dependency', async () => {
    expect(
      await getStreamAfterSubstreamOn(
        createView({ view: 'live', camera: 'camera.office' }),
      ),
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

    expect(await getStreamAfterSubstreamOn(view)).toBe('camera.office');
  });

  it('should treat a malformed override as the start of the cycle', async () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
      context: {
        live: { overrides: new Map([['camera.office', 'NOT_A_REAL_CAMERA']]) },
      },
    });

    expect(await getStreamAfterSubstreamOn(view)).toBe('camera.office');
  });

  it('should engage no substream when there are no usable dependencies', async () => {
    const view = createView({ view: 'live', camera: 'camera.office' });

    expect(await getStreamAfterSubstreamOn(view, createStore())).toBe('camera.office');
  });

  it('should engage no substream when the view has no camera', async () => {
    expect(
      await getStreamAfterSubstreamOn(createView({ view: 'live', camera: null })),
    ).toBeNull();
  });

  it('should do nothing without a view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    await createAction().execute(api);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });
});
