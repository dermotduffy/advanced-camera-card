import { expect, it } from 'vitest';
import { SubstreamSelectAction } from '../../../../src/card-controller/actions/actions/substream-select';
import { SubstreamViewModifier } from '../../../../src/components-lib/live/substream';
import { createCardAPI } from '../../../test-utils';

it('should handle live_substream_select action', async () => {
  const api = createCardAPI();
  const action = new SubstreamSelectAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'live_substream_select',
      camera: 'substream',
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewByParameters).toBeCalledWith({
    modifiers: [expect.any(SubstreamViewModifier)],
  });
});
