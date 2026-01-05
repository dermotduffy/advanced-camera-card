import { describe, expect, it, vi } from 'vitest';
import { CameraSelectAction } from '../../../../src/card-controller/actions/actions/camera-select';
import { createCardAPI, createConfig, createView } from '../../../test-utils';

describe('should handle camera_select action', () => {
  it('with valid camera and view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
        camera: 'camera.office',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith(
      expect.objectContaining({
        params: {
          view: 'live',
          camera: 'camera.office',
        },
        failSafe: true,
      }),
    );
  });

  it('should ignore requests to change to the current camera', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        camera: 'camera.office',
      }),
    );

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
        camera: 'camera.office',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
  });

  it('without config', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        view: 'timeline',
      }),
    );

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
        camera: 'camera.office',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith(
      expect.objectContaining({
        params: {
          view: 'timeline',
          camera: 'camera.office',
        },
        failSafe: true,
      }),
    );
  });

  it('with target view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          // Change to clips view when the camera changes.
          camera_select: 'clips',
        },
      }),
    );
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        view: 'live',
      }),
    );

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
        camera: 'camera.office',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith(
      expect.objectContaining({
        params: {
          view: 'clips',
          camera: 'camera.office',
        },
        failSafe: true,
      }),
    );
  });

  it('with triggered camera', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
    vi.mocked(api.getTriggersManager().getMostRecentlyTriggeredCameraID).mockReturnValue(
      'camera.office',
    );

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
        triggered: true,
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith(
      expect.objectContaining({
        params: {
          view: 'live',
          camera: 'camera.office',
        },
        failSafe: true,
      }),
    );
  });

  it('without camera or triggered camera', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
    vi.mocked(api.getTriggersManager().getMostRecentlyTriggeredCameraID).mockReturnValue(
      'camera.office',
    );

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
  });

  it('without a current view', async () => {
    const api = createCardAPI();

    const action = new CameraSelectAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'camera_select',
        camera: 'camera',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).not.toBeCalled();
  });
});
