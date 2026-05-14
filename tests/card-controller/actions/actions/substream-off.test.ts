import { expect, it } from 'vitest';
import { SubstreamOffAction } from '../../../../src/card-controller/actions/actions/substream-off';
import { SubstreamOffViewModifier } from '../../../../src/components-lib/live/substream';
import { createCardAPI } from '../../../test-utils';

it('should handle live_substream_off action', async () => {
  const api = createCardAPI();
  const action = new SubstreamOffAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'live_substream_off',
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewByParameters).toBeCalledWith({
    modifiers: [expect.any(SubstreamOffViewModifier)],
  });
});
