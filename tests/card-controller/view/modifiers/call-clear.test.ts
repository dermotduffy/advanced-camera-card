import { expect, it } from 'vitest';
import { CallClearViewModifier } from '../../../../src/card-controller/view/modifiers/call-clear';
import { createView } from '../../../test-utils';

it('should clear call context', () => {
  const modifier = new CallClearViewModifier();
  const view = createView({
    context: {
      call: {
        camera: 'camera-1',
        stream: 'doorbell',
        state: 'in_call',
      },
    },
  });

  modifier.modify(view);

  expect(view.context).toEqual({});
});
