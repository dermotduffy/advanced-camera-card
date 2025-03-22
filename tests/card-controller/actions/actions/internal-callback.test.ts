import { expect, it, vi } from 'vitest';
import { InternalCallbackAction } from '../../../../src/card-controller/actions/actions/internal-callback';
import { INTERNAL_CALLBACK_ACTION } from '../../../../src/config/schema/actions/custom/internal';
import { createCardAPI } from '../../../test-utils';

it('should handle internal callback action', async () => {
  const api = createCardAPI();
  const callback = vi.fn();
  const action = new InternalCallbackAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: INTERNAL_CALLBACK_ACTION,
      callback: callback,
    },
  );

  await action.execute(api);

  expect(callback).toBeCalledWith(api);
});
