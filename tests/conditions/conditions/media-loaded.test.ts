import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createMediaLoadedInfo } from '../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('media loaded condition', () => {
  it('should match a media loaded condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'media_loaded' as const, media_loaded: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ mediaLoadedInfo: createMediaLoadedInfo() }).result,
    ).toBeTruthy();
    expect(evaluator.evaluate({ mediaLoadedInfo: null }).result).toBeFalsy();
  });
});
