import { expect, it } from 'vitest';

import { DisplayModeSelectAction } from '../../../../src/card-controller/actions/actions/display-mode-select';
import { createCardAPI } from '../../../test-utils';

it('should handle default action', async () => {
  const api = createCardAPI();
  const action = new DisplayModeSelectAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'display_mode_select',
      display_mode: 'grid',
    },
  );

  await action.execute(api);

  expect(api.getViewManager().setViewByParametersWithNewQuery).toHaveBeenCalledWith({
    params: {
      displayMode: 'grid',
    },
  });
});
