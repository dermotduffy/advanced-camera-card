import { describe, expect, it, Mock, vi } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { ConfigTrigger } from '../../../../src/condition-trigger/triggers/triggers/config';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createConfig } from '../../../test-utils';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('ConfigTrigger', () => {
  const create = (
    trigger: TriggerOfType<'config'>,
  ): {
    configTrigger: ConfigTrigger;
    stateManager: ConditionStateManager;
    callback: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    const configTrigger = new ConfigTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    );
    return { configTrigger, stateManager, callback };
  };

  it('should trigger whenever the config changes', () => {
    const { configTrigger, stateManager, callback } = create({ trigger: 'config' });
    configTrigger.subscribe(callback);

    stateManager.setState({ config: createConfig() });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ config: createConfig({ menu: { style: 'outside' } }) });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should not trigger when the config is unchanged', () => {
    const { configTrigger, stateManager, callback } = create({ trigger: 'config' });
    configTrigger.subscribe(callback);

    stateManager.setState({ config: createConfig() });
    expect(callback).toHaveBeenCalledTimes(1);

    // An unrelated state change leaves the config untouched.
    stateManager.setState({ fullscreen: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger only when a listed path changes', () => {
    const { configTrigger, stateManager, callback } = create({
      trigger: 'config',
      paths: ['menu.style'],
    });
    configTrigger.subscribe(callback);

    stateManager.setState({
      config: createConfig({ menu: { style: 'outside', position: 'top' } }),
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // A config change that leaves `menu.style` untouched does not trigger.
    stateManager.setState({
      config: createConfig({ menu: { style: 'outside', position: 'bottom' } }),
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Changing `menu.style` triggers.
    stateManager.setState({
      config: createConfig({ menu: { style: 'hidden', position: 'bottom' } }),
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should include camera, view and config in the trigger data', () => {
    const config = createConfig();
    const config2 = createConfig({ menu: { style: 'outside' } });
    const { configTrigger, stateManager, callback } = create({ trigger: 'config' });
    configTrigger.subscribe(callback);

    stateManager.setState({ config, camera: 'front', view: 'live' });
    stateManager.setState({ config: config2 });
    expect(callback).toHaveBeenLastCalledWith({
      platform: 'acc',
      type: 'config',
      from_acc: { camera: 'front', view: 'live', config },
      to_acc: { camera: 'front', view: 'live', config: config2 },
    });
  });

  it('should stop triggering after destroy', () => {
    const { configTrigger, stateManager, callback } = create({ trigger: 'config' });
    configTrigger.subscribe(callback);
    configTrigger.destroy();

    stateManager.setState({ config: createConfig() });
    expect(callback).not.toHaveBeenCalled();
  });
});
