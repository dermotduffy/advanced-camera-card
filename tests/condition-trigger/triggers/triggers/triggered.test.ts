import { describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { TriggeredTrigger } from '../../../../src/condition-trigger/triggers/triggers/triggered';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';

// @vitest-environment jsdom
describe('TriggeredTrigger', () => {
  const create = (
    trigger: TriggerOfType<'triggered'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new TriggeredTrigger(trigger, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    }).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger on any change to the triggered set without a value', () => {
    const { stateManager, callback } = create({ trigger: 'triggered' });
    stateManager.setState({ triggered: new Set(['front']) });
    stateManager.setState({ triggered: new Set(['front', 'back']) });
    stateManager.setState({ triggered: new Set() });
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should trigger only when a listed camera is among the triggered set', () => {
    const { stateManager, callback } = create({
      trigger: 'triggered',
      triggered: ['front'],
    });

    stateManager.setState({ triggered: new Set(['back']) });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ triggered: new Set(['front']) });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
