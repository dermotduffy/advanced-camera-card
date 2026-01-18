import { describe, expect, it, vi } from 'vitest';
import { View } from '../../../../src/view/view';
import { QueryResults } from '../../../../src/view/query-results';
import { InfoAction } from '../../../../src/card-controller/actions/actions/info';
import { createCardAPI, TestViewMedia } from '../../../test-utils';

describe('InfoAction', () => {
  it('should handle info action with media', async () => {
    const api = createCardAPI();
    const item = new TestViewMedia();
    const view = new View({
      view: 'clip',
      camera: 'camera',
      queryResults: new QueryResults({
        results: [item],
        selectedIndex: 0,
      }),
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new InfoAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'info',
      },
    );

    await action.execute(api);

    expect(api.getOverlayMessageManager().setMessage).toBeCalled();
  });

  it('should not handle info action without media', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    const action = new InfoAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'info',
      },
    );

    await action.execute(api);

    expect(api.getOverlayMessageManager().setMessage).not.toBeCalled();
  });
});
