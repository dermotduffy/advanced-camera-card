import { expect, it } from 'vitest';
import { CallSetViewModifier } from '../../../../src/card-controller/view/modifiers/call-set';
import { createView } from '../../../test-utils';

it('should set call context', () => {
  const modifier = new CallSetViewModifier({
    camera: 'camera-1',
    stream: 'doorbell',
    state: 'connecting_call',
  });
  const view = createView();

  modifier.modify(view);

  expect(view.context).toEqual({
    call: {
      camera: 'camera-1',
      stream: 'doorbell',
      state: 'connecting_call',
    },
  });
});