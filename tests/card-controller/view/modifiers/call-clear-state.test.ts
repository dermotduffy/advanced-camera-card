import { expect, it } from 'vitest';
import { CallClearStateViewModifier } from '../../../../src/card-controller/view/modifiers/call-clear-state';
import { createView } from '../../../test-utils';

it('should clear only the call state', () => {
  const modifier = new CallClearStateViewModifier();
  const view = createView({
    context: {
      call: {
        camera: 'camera-1',
        stream: 'doorbell',
        state: 'ending_call',
      },
    },
  });

  modifier.modify(view);

  expect(view.context).toEqual({
    call: {
      camera: 'camera-1',
      stream: 'doorbell',
    },
  });
});
