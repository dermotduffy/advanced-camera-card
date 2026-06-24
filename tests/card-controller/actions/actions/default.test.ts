import { expect, it } from 'vitest';

import { DefaultAction } from '../../../../src/card-controller/actions/actions/default';
import { createCardAPI } from '../../../test-utils';

it('should handle default action', async () => {
  const api = createCardAPI();
  const action = new DefaultAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'default',
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewDefaultWithNewQuery).toBeCalled();
});
