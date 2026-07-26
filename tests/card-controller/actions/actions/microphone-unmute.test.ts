import { expect, it } from 'vitest';

import { MicrophoneUnmuteAction } from '../../../../src/card-controller/actions/actions/microphone-unmute';
import { createCardAPI } from '../../../test-utils';

it('should handle microphone_unmute action', async () => {
  const api = createCardAPI();
  const action = new MicrophoneUnmuteAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'microphone_unmute',
    },
  );

  await action.execute(api);

  expect(api.getMicrophoneManager().unmute).toHaveBeenCalled();
});
