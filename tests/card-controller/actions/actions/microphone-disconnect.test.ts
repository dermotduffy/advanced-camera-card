import { expect, it } from 'vitest';

import { MicrophoneDisconnectAction } from '../../../../src/card-controller/actions/actions/microphone-disconnect';
import { createCardAPI } from '../../../test-utils';

it('should handle microphone_disconnect action', async () => {
  const api = createCardAPI();
  const action = new MicrophoneDisconnectAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'microphone_disconnect',
    },
  );

  await action.execute(api);

  expect(api.getMicrophoneManager().disconnect).toBeCalled();
});
