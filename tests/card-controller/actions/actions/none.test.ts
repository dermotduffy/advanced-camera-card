import { it } from 'vitest';
import { NoneAction } from '../../../../src/card-controller/actions/actions/none';
import { createCardAPI } from '../../../test-utils';

it('should handle none action', async () => {
  const api = createCardAPI();
  const action = new NoneAction(
    {},
    {
      action: 'none' as const,
    },
  );

  await action.execute(api);

  // No observable side effects.
});
