import { describe, expect, it } from 'vitest';

import { MicrophoneState } from '../../../../src/card-controller/types';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('microphone condition', () => {
  const createMicrophoneState = (state: Partial<MicrophoneState>): MicrophoneState => {
    return {
      connected: false,
      muted: false,
      forbidden: false,
      ...state,
    };
  };

  it('should match when muted is true', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, muted: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: true }) }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: false }) }).result,
    ).toBeFalsy();
  });

  it('should match when muted is false', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, muted: false },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: true }) }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: false }) }).result,
    ).toBeTruthy();
  });
});
