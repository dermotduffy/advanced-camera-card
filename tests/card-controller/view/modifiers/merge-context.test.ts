import { ViewContext } from 'view';
import { expect, it } from 'vitest';

import { MergeContextViewModifier } from '../../../../src/card-controller/view/modifiers/merge-context';
import { createView } from '../../../test-utils';

it('should merge context', () => {
  const context: ViewContext = {
    timeline: {
      window: {
        start: new Date(),
        end: new Date(),
      },
    },
  };
  const modifier = new MergeContextViewModifier(context);

  const view = createView({
    view: 'live',
    camera: 'camera',
    displayMode: 'grid',
  });

  expect(view.context).toBeNull();

  modifier.modify(view);

  expect(view.context).toEqual(context);
});
