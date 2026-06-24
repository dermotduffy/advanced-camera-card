import { expect, it } from 'vitest';

import { MenuToggleAction } from '../../../../src/card-controller/actions/actions/menu-toggle';
import { createCardAPI } from '../../../test-utils';

it('should handle menu toggle action', async () => {
  const api = createCardAPI();
  const action = new MenuToggleAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'menu_toggle',
    },
  );

  await action.execute(api);

  expect(api.getCardElementManager().toggleMenu).toBeCalled();
});
