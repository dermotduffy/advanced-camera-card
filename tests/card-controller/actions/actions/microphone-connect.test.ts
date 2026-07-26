import { expect, it } from 'vitest';

import { MicrophoneConnectAction } from '../../../../src/card-controller/actions/actions/microphone-connect';
import { createCardAPI } from '../../../test-utils';

it('should handle microphone_connect action', async () => {
  const api = createCardAPI();
  const action = new MicrophoneConnectAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'microphone_connect',
    },
  );

  await action.execute(api);

  expect(api.getMicrophoneManager().connect).toHaveBeenCalled();
});
