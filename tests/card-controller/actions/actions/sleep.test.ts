import { expect, it, vi } from 'vitest';
import { SleepAction } from '../../../../src/card-controller/actions/actions/sleep';
import { sleep } from '../../../../src/utils/sleep';
import { createCardAPI } from '../../../test-utils';

vi.mock('../../../../src/utils/sleep');

it('should handle sleep action', async () => {
  const api = createCardAPI();
  const action = new SleepAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'sleep',
      duration: {
        s: 5,
        ms: 200,
      },
    },
  );

  await action.execute(api);

  expect(sleep).toBeCalledWith(5.2);
});
