import { expect, it } from 'vitest';
import { applyViewModifiers } from '../../../../src/card-controller/view/modifiers';
import { MergeContextViewModifier } from '../../../../src/card-controller/view/modifiers/merge-context';
import { SetQueryViewModifier } from '../../../../src/card-controller/view/modifiers/set-query';
import { EventMediaQueries } from '../../../../src/view/media-queries';
import { MediaQueriesResults } from '../../../../src/view/media-queries-results';
import { createView } from '../../../test-utils';

it('should apply view modifiers', () => {
  const view = createView();

  const query = new EventMediaQueries();
  const queryResults = new MediaQueriesResults();

  const context = {
    timeline: { window: { start: new Date(), end: new Date() } },
  };

  const modifiers = [
    new SetQueryViewModifier({
      query: query,
      queryResults: queryResults,
    }),
    new MergeContextViewModifier(context),
  ];

  applyViewModifiers(view, modifiers);

  expect(view.query).toBe(query);
  expect(view.queryResults).toBe(queryResults);
  expect(view.context).toEqual(context);
});
