import { expect, it } from 'vitest';

import { ExpandAction } from '../../../../src/card-controller/actions/actions/expand';
import { createCardAPI } from '../../../test-utils';

it('should handle expand action', async () => {
  const api = createCardAPI();
  const action = new ExpandAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'expand',
    },
  );

  await action.execute(api);

  expect(api.getExpandManager().toggleExpanded).toBeCalled();
});
