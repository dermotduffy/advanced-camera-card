import { expect, it } from 'vitest';
import { CallAnswerAction } from '../../../../src/card-controller/actions/actions/call-answer';
import { createCardAPI } from '../../../test-utils';

it('should handle call_answer action', async () => {
  const api = createCardAPI();
  const action = new CallAnswerAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'call_answer',
    },
  );

  await action.execute(api);

  expect(api.getCallManager().answer).toBeCalled();
});
