import { expect, it } from 'vitest';

import { CameraUIAction } from '../../../../src/card-controller/actions/actions/camera-ui';
import { createCardAPI } from '../../../test-utils';

it('should handle camera_ui action', async () => {
  const api = createCardAPI();
  const action = new CameraUIAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'camera_ui',
    },
  );

  await action.execute(api);

  expect(api.getCameraURLManager().openURL).toHaveBeenCalled();
});
