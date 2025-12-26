import { describe, expect, it, vi } from 'vitest';
import { SetReviewAction } from '../../../../src/card-controller/actions/actions/set-review';
import { ViewMediaType } from '../../../../src/view/item';
import { QueryResults } from '../../../../src/view/query-results';
import { createCardAPI, createView, TestViewMedia } from '../../../test-utils';

describe('SetReviewAction', () => {
  it('should mark item as reviewed', async () => {
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

    expect(api.getViewItemManager().reviewMedia).toBeCalledWith(item, true);
    expect(item.isReviewed()).toBe(true);
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should toggle review status when reviewed is not specified', async () => {
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
      },
    );
    await action.execute(api);

    // Toggle: isReviewed was true, so reviewed should be set to false
    expect(api.getViewItemManager().reviewMedia).toBeCalledWith(item, false);
    expect(item.isReviewed()).toBe(false);
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

    expect(api.getViewItemManager().reviewMedia).not.toBeCalled();
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

    expect(api.getViewItemManager().reviewMedia).not.toBeCalled();
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

    expect(api.getViewItemManager().reviewMedia).not.toBeCalled();
  });
});
