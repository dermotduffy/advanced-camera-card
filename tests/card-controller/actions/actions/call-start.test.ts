import { expect, it } from 'vitest';
import { CallStartAction } from '../../../../src/card-controller/actions/actions/call-start';
import { createCardAPI } from '../../../test-utils';

it('should handle call start action', async () => {
  const api = createCardAPI();
  const action = new CallStartAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'call_start',
    },
  );

  await action.execute(api);

  expect(api.getCallManager().startCall).toBeCalled();
});