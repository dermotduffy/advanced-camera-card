import { expect, it } from 'vitest';
import { SetQueryViewModifier } from '../../../../src/card-controller/view/modifiers/set-query';
import { QueryResults } from '../../../../src/view/query-results';
import { UnifiedQuery } from '../../../../src/view/unified-query';
import { createView } from '../../../test-utils';

it('should do nothing without arguments', () => {
  const view = createView();

  const modifier = new SetQueryViewModifier();
  modifier.modify(view);

  expect(view.query).toBeNull();
  expect(view.queryResults).toBeNull();
});

it('should set query and results', () => {
  const view = createView();
  const query = new UnifiedQuery();
  const queryResults = new QueryResults();

  const modifier = new SetQueryViewModifier({
    query: query,
    queryResults: queryResults,
  });
  modifier.modify(view);

  expect(view.query).toBe(query);
  expect(view.queryResults).toBe(queryResults);
});
