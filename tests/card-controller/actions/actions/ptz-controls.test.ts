import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PTZControlsAction } from '../../../../src/card-controller/actions/actions/ptz-controls';
import { View } from '../../../../src/view/view';
import { createCardAPI } from '../../../test-utils';

describe('PTZControlsAction', () => {
  it('should set enabled explicitly', async () => {
    const api = createCardAPI();
    const action = new PTZControlsAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_controls',
        enabled: true,
        type: 'buttons',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      ptzControls: { enabled: true, type: 'buttons' },
    });
  });

  it('should toggle enabled when not specified', async () => {
    const api = createCardAPI();
    const view = mock<View>();
    view.context = { ptzControls: { enabled: true } };
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new PTZControlsAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_controls',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      ptzControls: { enabled: false },
    });
  });

  it('should not set enabled when currently undefined and not specified', async () => {
    const api = createCardAPI();

    const action = new PTZControlsAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_controls',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      ptzControls: {},
    });
  });

  it('should set type without affecting enabled when not specified', async () => {
    const api = createCardAPI();

    const action = new PTZControlsAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_controls',
        type: 'gestures',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      ptzControls: { type: 'gestures' },
    });
  });

  it('should set type only leaving enabled unchanged', async () => {
    const api = createCardAPI();
    const view = mock<View>();
    view.context = { ptzControls: { enabled: true } };
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new PTZControlsAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'ptz_controls',
        type: 'buttons',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
      ptzControls: { type: 'buttons' },
    });
  });
});
