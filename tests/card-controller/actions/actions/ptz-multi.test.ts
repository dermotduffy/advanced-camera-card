import { describe, expect, it, vi } from 'vitest';
import { Capabilities } from '../../../../src/camera-manager/capabilities';
import { PTZMultiAction } from '../../../../src/card-controller/actions/actions/ptz-multi';
import { PTZMovementType } from '../../../../src/types';
import {
  createCameraManager,
  createCardAPI,
  createStore,
  createView,
} from '../../../test-utils';

describe('should handle ptz multi action', () => {
  describe.each([
    ['with explicit target_id', 'camera.office'],
    ['without explicit target_id', null],
  ])('%s', async (_testTitle: string, targetID: string | null) => {
    it('should use real ptz when camera has ptz support', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.office',
        }),
      );
      const store = createStore([
        {
          cameraID: 'camera.office',
          capabilities: new Capabilities({ ptz: { left: [PTZMovementType.Relative] } }),
        },
      ]);
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));

      const action = new PTZMultiAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_multi',
          ptz_action: 'left',
          ...(targetID && { target_id: targetID }),
        },
      );

      await action.execute(api);

      expect(api.getCameraManager().executePTZAction).toBeCalledWith(
        'camera.office',
        'left',
        {
          phase: undefined,
          preset: undefined,
        },
      );
      expect(api.getViewManager().setViewWithMergedContext).not.toBeCalled();
    });

    it('should use digital ptz when camera does not have ptz support', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.office',
        }),
      );
      const store = createStore([
        {
          cameraID: 'camera.office',
        },
      ]);
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));

      const action = new PTZMultiAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'ptz_multi',
          ptz_action: 'right',
          ...(targetID && { target_id: targetID }),
        },
      );

      await action.execute(api);

      expect(api.getCameraManager().executePTZAction).not.toBeCalled();
      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenLastCalledWith({
        zoom: {
          'camera.office': {
            observed: undefined,
            requested: expect.objectContaining({
              pan: {
                x: 55,
                y: 50,
              },
              zoom: 1,
            }),
          },
        },
      });
    });
  });

  it('should do nothing without a view or explicit target_id', async () => {
    const api = createCardAPI();
    const store = createStore([
      {
        cameraID: 'camera.office',
      },
    ]);
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));

    const action = new PTZMultiAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_multi',
        ptz_action: 'right',
      },
    );

    await action.execute(api);

    expect(api.getCameraManager().executePTZAction).not.toBeCalled();
    expect(api.getViewManager().setViewWithMergedContext).not.toBeCalled();
  });

  it('should do nothing with a media-less view without an explicit target_id', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        view: 'timeline',
      }),
    );
    const store = createStore([
      {
        cameraID: 'camera.office',
      },
    ]);
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));

    const action = new PTZMultiAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_multi',
        ptz_action: 'right',
      },
    );

    await action.execute(api);

    expect(api.getCameraManager().executePTZAction).not.toBeCalled();
    expect(api.getViewManager().setViewWithMergedContext).not.toBeCalled();
  });
});
