import { expect, it } from 'vitest';
import { PIPAction } from '../../../../src/card-controller/actions/actions/pip';
import { createCardAPI } from '../../../test-utils';

it('should toggle PIP', async () => {
  const api = createCardAPI();
  const action = new PIPAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'pip',
    },
  );

  await action.execute(api);

  expect(api.getPIPManager().togglePIP).toBeCalled();
});
