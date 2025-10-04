import { describe, expect, it } from 'vitest';
import { ViewAction } from '../../../../src/card-controller/actions/actions/view';
import { createCardAPI } from '../../../test-utils';

describe('should handle view action', () => {
  it.each([
    ['clip' as const],
    ['clips' as const],
    ['diagnostics' as const],
    ['image' as const],
    ['live' as const],
    ['recording' as const],
    ['recordings' as const],
    ['snapshot' as const],
    ['snapshots' as const],
    ['timeline' as const],
  ])('%s', async (viewName) => {
    const api = createCardAPI();

    const action = new ViewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: viewName,
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith(
      expect.objectContaining({
        params: {
          view: viewName,
        },
      }),
    );
  });
});

describe('should handle folder view action', () => {
  it.each([['folder' as const], ['folders' as const]])('%s', async (viewName) => {
    const api = createCardAPI();

    const action = new ViewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: viewName,
        folder: 'folder',
      },
    );

    await action.execute(api);

    expect(api.getViewManager().setViewByParametersWithNewQuery).toBeCalledWith(
      expect.objectContaining({
        params: {
          view: viewName,
        },
        queryExecutorOptions: {
          folder: 'folder',
        },
      }),
    );
  });
});
