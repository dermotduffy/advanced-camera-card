import { expect, it } from 'vitest';

import { FullscreenAction } from '../../../../src/card-controller/actions/actions/fullscreen';
import { createCardAPI } from '../../../test-utils';

it('should handle fullscreen action', async () => {
  const api = createCardAPI();
  const action = new FullscreenAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'fullscreen',
    },
  );

  await action.execute(api);

  expect(api.getFullscreenManager().toggleFullscreen).toBeCalled();
});
