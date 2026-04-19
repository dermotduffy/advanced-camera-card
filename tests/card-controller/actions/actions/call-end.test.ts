import { expect, it } from 'vitest';
import { CallEndAction } from '../../../../src/card-controller/actions/actions/call-end';
import { createCardAPI } from '../../../test-utils';

it('should handle call end action', async () => {
  const api = createCardAPI();
  const action = new CallEndAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'call_end',
    },
  );

  await action.execute(api);

  expect(api.getCallManager().endCall).toBeCalled();
});