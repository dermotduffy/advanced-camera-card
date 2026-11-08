import { expect, it } from 'vitest';

import { RemoveItemViewModifier } from '../../../../src/card-controller/view/modifiers/remove-item';
import { QueryResults } from '../../../../src/view/query-results';
import { createView, TestViewMedia } from '../../../view/test-utils';

it('should do nothing without results', () => {
  const view = createView();

  new RemoveItemViewModifier(new TestViewMedia({ id: 'id' })).modify(view);

  expect(view.queryResults).toBeNull();
});

it('should remove every result with a matching id', () => {
  const item = new TestViewMedia({ id: 'event-1' });
  const duplicate = new TestViewMedia({ id: 'event-1' });
  const other = new TestViewMedia({ id: 'event-2' });
  const view = createView({
    queryResults: new QueryResults({ results: [item, duplicate, other] }),
  });

  new RemoveItemViewModifier(item).modify(view);

  expect(view.queryResults?.getResults()).toEqual([other]);
});

it('should ignore an item that is not present', () => {
  const item = new TestViewMedia({ id: 'event-1' });
  const view = createView({ queryResults: new QueryResults({ results: [item] }) });

  new RemoveItemViewModifier(new TestViewMedia({ id: 'event-2' })).modify(view);

  expect(view.queryResults?.getResults()).toEqual([item]);
});
