import { expect, it } from 'vitest';
import { SubstreamOnAction } from '../../../../src/card-controller/actions/actions/substream-on';
import { SubstreamOnViewModifier } from '../../../../src/components-lib/live/substream';
import { createCardAPI } from '../../../test-utils';

it('should handle live_substream_on action', async () => {
  const api = createCardAPI();
  const action = new SubstreamOnAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'live_substream_on',
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewByParameters).toBeCalledWith({
    modifiers: [expect.any(SubstreamOnViewModifier)],
  });
});
