import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { KeyTrigger } from '../../../../src/condition-trigger/triggers/triggers/key';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

describe('KeyTrigger', () => {
  const create = (
    trigger: TriggerOfType<'key'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new KeyTrigger(trigger, createTriggerEvaluatorContext({ stateManager })).subscribe(
      callback,
    );
    return { stateManager, callback };
  };

  const modifiers = { ctrl: false, shift: false, alt: false, meta: false };
  const down = { state: 'down' as const, ...modifiers };
  const up = { state: 'up' as const, ...modifiers };

  it('should trigger when the key is pressed', () => {
    const { stateManager, callback } = create({ trigger: 'key', key: 'a' });

    stateManager.setState({ keys: { a: down } });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger when the key is released', () => {
    const { stateManager, callback } = create({
      trigger: 'key',
      key: 'a',
      state: 'up',
    });

    stateManager.setState({ keys: { a: down } });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ keys: { a: up } });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when another key changes', () => {
    const { stateManager, callback } = create({
      trigger: 'key',
      key: 'a',
      state: 'up',
    });

    stateManager.setState({ keys: { a: down } });
    stateManager.setState({ keys: { a: up } });
    expect(callback).toHaveBeenCalledTimes(1);

    // 'a' is still released, so its condition still holds, but the user acted
    // on a different key entirely.
    stateManager.setState({ keys: { a: up, b: down } });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on any key without a key of its own', () => {
    const { stateManager, callback } = create({ trigger: 'key' });

    stateManager.setState({ keys: { a: down } });
    stateManager.setState({ keys: { a: down, b: down } });

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
