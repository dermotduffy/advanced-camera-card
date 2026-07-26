import { afterEach, expect, it, vi } from 'vitest';

import { LogAction } from '../../../../src/card-controller/actions/actions/log';
import { createCardAPI } from '../../../test-utils';

afterEach(() => {
  vi.resetAllMocks();
});

it('should handle log action', async () => {
  const api = createCardAPI();
  const action = new LogAction(
    {},
    {
      action: 'fire-dom-event',
      advanced_camera_card_action: 'log',
      message: 'Hello, world!',
      level: 'warn',
    },
  );

  const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);
  await action.execute(api);
  expect(spy).toHaveBeenCalledWith('Hello, world!');
});
