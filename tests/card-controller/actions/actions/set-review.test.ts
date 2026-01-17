import { assert, describe, expect, it, vi } from 'vitest';
import { SetReviewAction } from '../../../../src/card-controller/actions/actions/set-review';
import { ViewMedia, ViewMediaType } from '../../../../src/view/item';
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

    // Original item is NOT mutated; a clone is created and replaced.
    expect(item.isReviewed()).toBe(false);

    const setViewParams = vi.mocked(api.getViewManager().setViewByParameters).mock
      .calls[0][0];
    const newResults = setViewParams?.params?.queryResults;
    expect(newResults).toBeInstanceOf(QueryResults);

    const newItem = newResults?.getSelectedResult();
    expect(newItem).not.toBe(item);
    assert(newItem instanceof ViewMedia);
    expect(newItem?.isReviewed()).toBe(true);
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

    // Toggle: isReviewed was true, so reviewed should be set to false.
    expect(api.getViewItemManager().reviewMedia).toBeCalledWith(item, false);

    // Original item is NOT mutated; a clone is created and replaced.
    expect(item.isReviewed()).toBe(true);

    const setViewParams = vi.mocked(api.getViewManager().setViewByParameters).mock
      .calls[0][0];
    const newResults = setViewParams?.params?.queryResults;
    expect(newResults).toBeInstanceOf(QueryResults);

    const newItem = newResults?.getSelectedResult();
    expect(newItem).not.toBe(item);
    assert(newItem instanceof ViewMedia);
    expect(newItem?.isReviewed()).toBe(false);
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
