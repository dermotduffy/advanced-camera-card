import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { stubMatchMedia } from '../../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('screen condition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should evaluate the media query', () => {
    stubMatchMedia().mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList);

    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const, media_query: 'whatever' },
      createEvaluatorContext(),
    );
    expect(evaluator.evaluate().result).toBeTruthy();
  });

  it('should expose the media query as an external invalidation source', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const, media_query: 'whatever' },
      createEvaluatorContext(),
    );
    expect(evaluator.externalSources).toHaveLength(1);
  });

  it('should not match or expose a source without a media query', () => {
    const matchMedia = stubMatchMedia();
    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate().result).toBeFalsy();
    expect(evaluator.externalSources).toHaveLength(0);
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
