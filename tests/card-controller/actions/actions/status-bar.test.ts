import { describe, expect, it } from 'vitest';
import { StatusBarAction } from '../../../../src/card-controller/actions/actions/status-bar';
import { createCardAPI } from '../../../test-utils';

describe('should handle status bar action', () => {
  it('reset', async () => {
    const api = createCardAPI();
    const action = new StatusBarAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'status_bar',
        status_bar_action: 'reset',
      },
    );

    await action.execute(api);

    expect(api.getStatusBarItemManager().removeAllDynamicStatusBarItems).toBeCalled();
  });

  it('add', async () => {
    const api = createCardAPI();
    const item = {
      type: 'custom:advanced-camera-card-status-bar-string' as const,
      string: 'Item',
    };

    const action = new StatusBarAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'status_bar',
        status_bar_action: 'add',
        items: [item],
      },
    );

    await action.execute(api);

    expect(api.getStatusBarItemManager().addDynamicStatusBarItem).toBeCalledWith(item);
  });

  it('remove', async () => {
    const api = createCardAPI();
    const item = {
      type: 'custom:advanced-camera-card-status-bar-string' as const,
      string: 'Item',
    };

    const action = new StatusBarAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'status_bar',
        status_bar_action: 'remove',
        items: [item],
      },
    );

    await action.execute(api);

    expect(api.getStatusBarItemManager().removeDynamicStatusBarItem).toBeCalledWith(
      item,
    );
  });
});
