import { expect, it } from 'vitest';

import { ZoomRequestViewModifier } from '../../../../src/card-controller/view/modifiers/zoom-request';
import { createView } from '../../../view/test-utils';

it('should write a request when the target has no zoom context', () => {
  const view = createView();

  new ZoomRequestViewModifier('target', { zoom: 3 }).modify(view);

  expect(view.context?.zoom?.target.requested).toEqual({ zoom: 3 });
});

it('should preserve the observed settings of the target', () => {
  const observed = {
    pan: { x: 1, y: 2 },
    zoom: 3,
    isDefault: false,
    unzoomed: false,
  };
  const view = createView({ context: { zoom: { target: { observed } } } });

  new ZoomRequestViewModifier('target', { zoom: 4 }).modify(view);

  expect(view.context?.zoom?.target.observed).toEqual(observed);
});

it('should replace an earlier request rather than merge into it', () => {
  const view = createView({
    context: { zoom: { target: { requested: { zoom: 3, pan: { x: 1, y: 2 } } } } },
  });

  new ZoomRequestViewModifier('target', { pan: { x: 5, y: 6 } }).modify(view);

  expect(view.context?.zoom?.target.requested).toEqual({ pan: { x: 5, y: 6 } });
});

it('should allow an empty request to erase an earlier request', () => {
  const view = createView({
    context: { zoom: { target: { requested: { zoom: 3 } } } },
  });

  new ZoomRequestViewModifier('target', {}).modify(view);

  expect(view.context?.zoom?.target.requested).toEqual({});
});
