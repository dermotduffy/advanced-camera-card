import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('user agent condition', () => {
  const userAgent =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  it('should match exact user agent', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'user_agent' as const, user_agent: userAgent },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ userAgent: userAgent }).result).toBeTruthy();
    expect(evaluator.evaluate({ userAgent: 'Something else' }).result).toBeFalsy();
  });

  it('should match user agent regex', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'user_agent' as const, user_agent_re: 'Chrome/' },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ userAgent: userAgent }).result).toBeTruthy();
    expect(evaluator.evaluate({ userAgent: 'Something else' }).result).toBeFalsy();
  });

  it('should match casting', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'user_agent' as const, casting: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ userAgent: 'CrKey/1.0' }).result).toBeTruthy();
    expect(evaluator.evaluate({ userAgent: userAgent }).result).toBeFalsy();
  });

  it('should match companion app', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'user_agent' as const, companion: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ userAgent: 'Home Assistant/' }).result).toBeTruthy();
    expect(evaluator.evaluate({ userAgent: userAgent }).result).toBeFalsy();
  });

  it('should match multiple parameters', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'user_agent' as const,
        companion: true,
        user_agent: 'Home Assistant/',
        user_agent_re: 'Home.Assistant',
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ userAgent: 'Home Assistant/' }).result).toBeTruthy();
    expect(evaluator.evaluate({ userAgent: 'Something else' }).result).toBeFalsy();
  });
});
