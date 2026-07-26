import { expect, it } from 'vitest';

import { MicrophoneMuteAction } from '../../../../src/card-controller/actions/actions/microphone-mute';
import { createCardAPI } from '../../../test-utils';

it('should handle microphone_mute action', async () => {
  const api = createCardAPI();
  const action = new MicrophoneMuteAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'microphone_mute',
    },
  );

  await action.execute(api);

  expect(api.getMicrophoneManager().mute).toHaveBeenCalled();
});
