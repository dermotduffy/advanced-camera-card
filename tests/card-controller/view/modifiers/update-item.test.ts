import { expect, it } from 'vitest';

import { UpdateItemViewModifier } from '../../../../src/card-controller/view/modifiers/update-item';
import { QueryResults } from '../../../../src/view/query-results';
import { createView, TestViewMedia } from '../../../view/test-utils';

it('should do nothing without results', () => {
  const view = createView();

  new UpdateItemViewModifier(new TestViewMedia({ id: 'id' })).modify(view);

  expect(view.queryResults).toBeNull();
});

it('should update every result with a matching id', () => {
  const item = new TestViewMedia({ id: 'event-1' });
  const duplicate = new TestViewMedia({ id: 'event-1' });
  const other = new TestViewMedia({ id: 'event-2' });
  const view = createView({
    queryResults: new QueryResults({ results: [item, duplicate, other] }),
  });

  new UpdateItemViewModifier(item).modify(view);

  const results = view.queryResults?.getResults();
  expect(results?.[0]).not.toBe(item);
  expect(results?.[0]?.getID()).toBe('event-1');
  expect(results?.[1]).not.toBe(duplicate);
  expect(results?.[2]).toBe(other);
});

it('should ignore an item that is not present', () => {
  const item = new TestViewMedia({ id: 'event-1' });
  const view = createView({ queryResults: new QueryResults({ results: [item] }) });

  new UpdateItemViewModifier(new TestViewMedia({ id: 'event-2' })).modify(view);

  expect(view.queryResults?.getResults()?.[0]).toBe(item);
});
