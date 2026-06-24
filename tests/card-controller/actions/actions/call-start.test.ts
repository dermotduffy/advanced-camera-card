import { expect, it } from 'vitest';

import { CallStartAction } from '../../../../src/card-controller/actions/actions/call-start';
import { createCardAPI } from '../../../test-utils';

it('should handle call_start action without a camera or stream', async () => {
  const api = createCardAPI();
  const action = new CallStartAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'call_start',
    },
  );

  await action.execute(api);

  expect(api.getCallManager().start).toBeCalledWith({
    cameraID: undefined,
    streamID: undefined,
  });
});

it('should handle call_start action with a camera and stream', async () => {
  const api = createCardAPI();
  const action = new CallStartAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'call_start',
      camera: 'camera.front',
      stream: 'camera.front_doorbell',
    },
  );

  await action.execute(api);

  expect(api.getCallManager().start).toBeCalledWith({
    cameraID: 'camera.front',
    streamID: 'camera.front_doorbell',
  });
});
