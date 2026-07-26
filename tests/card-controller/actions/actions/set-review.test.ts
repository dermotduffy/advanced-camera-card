import { describe, expect, it, vi } from 'vitest';

import { SetReviewAction } from '../../../../src/card-controller/actions/actions/set-review';
import { ViewMediaType } from '../../../../src/view/item';
import { QueryResults } from '../../../../src/view/query-results';
import { createCardAPI } from '../../../test-utils';
import { createView, TestViewMedia } from '../../../view/test-utils';

describe('SetReviewAction', () => {
  it('should toggle item reviewed state', async () => {
    const api = createCardAPI();
    const item = new TestViewMedia({
      cameraID: 'camera.office',
      mediaType: 'review' as ViewMediaType,
      reviewed: false,
    });

    const queryResults = new QueryResults({ results: [item], selectedIndex: 0 });
    const view = createView({ queryResults });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).toHaveBeenCalledWith(item, true);

    // toggleReviewed mutates the item in-place
    expect(item.isReviewed()).toBe(true);

    // Verify UI update is triggered to refresh menu icon
    expect(api.getCardElementManager().update).toHaveBeenCalled();
  });

  it('should set reviewed to true when requested and currently false', async () => {
    const api = createCardAPI();
    const item = new TestViewMedia({
      cameraID: 'camera.office',
      mediaType: 'review' as ViewMediaType,
      reviewed: false,
    });

    const queryResults = new QueryResults({ results: [item], selectedIndex: 0 });
    const view = createView({ queryResults });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
        reviewed: true,
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).toHaveBeenCalledWith(item, true);
    expect(item.isReviewed()).toBe(true);
  });

  it('should not act when requested state matches current state', async () => {
    const api = createCardAPI();
    const item = new TestViewMedia({
      cameraID: 'camera.office',
      mediaType: 'review' as ViewMediaType,
      reviewed: true,
    });

    const queryResults = new QueryResults({ results: [item], selectedIndex: 0 });
    const view = createView({ queryResults });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
        reviewed: true,
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).not.toHaveBeenCalled();
  });

  it('should not act on non-review media', async () => {
    const api = createCardAPI();
    const item = new TestViewMedia({
      cameraID: 'camera.office',
      mediaType: ViewMediaType.Clip,
    });

    const queryResults = new QueryResults({ results: [item], selectedIndex: 0 });
    const view = createView({ queryResults });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
        reviewed: true,
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).not.toHaveBeenCalled();
  });

  it('should not act without a view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
        reviewed: true,
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).not.toHaveBeenCalled();
  });

  it('should not act without query results', async () => {
    const api = createCardAPI();
    const view = createView();
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
        reviewed: true,
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).not.toHaveBeenCalled();
  });

  it('should not update UI if review action fails', async () => {
    const api = createCardAPI();
    const item = new TestViewMedia({
      cameraID: 'camera.office',
      mediaType: 'review' as ViewMediaType,
      reviewed: false,
    });

    const queryResults = new QueryResults({ results: [item], selectedIndex: 0 });
    const view = createView({ queryResults });
    vi.mocked(api.getViewManager().getView).mockReturnValue(view);
    vi.mocked(api.getViewItemManager().reviewMedia).mockRejectedValue(
      new Error('error'),
    );

    const action = new SetReviewAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'set_review',
      },
    );
    await action.execute(api);

    expect(api.getViewItemManager().reviewMedia).toHaveBeenCalledWith(item, true);
    expect(api.getCardElementManager().update).not.toHaveBeenCalled();
  });
});
