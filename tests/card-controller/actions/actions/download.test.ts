import { expect, it, vi } from 'vitest';

import { DownloadAction } from '../../../../src/card-controller/actions/actions/download';
import { QueryResults } from '../../../../src/view/query-results';
import { createCardAPI } from '../../../test-utils';
import { createView, TestViewMedia } from '../../../view/test-utils';

it('should handle download action with selected media', async () => {
  const api = createCardAPI();
  const selectedMedia = new TestViewMedia();
  vi.mocked(api.getViewManager().getView).mockReturnValue(
    createView({
      queryResults: new QueryResults({ results: [selectedMedia], selectedIndex: 0 }),
    }),
  );

  const action = new DownloadAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'download',
    },
  );

  await action.execute(api);

  expect(api.getViewItemManager().download).toHaveBeenCalledWith(selectedMedia);
});

it('should handle download action without selected media', async () => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(createView());

  const action = new DownloadAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'download',
    },
  );

  await action.execute(api);

  expect(api.getViewItemManager().download).not.toHaveBeenCalled();
});
