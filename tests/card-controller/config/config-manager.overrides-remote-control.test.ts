import { describe, expect, it, vi } from 'vitest';
import { createCardAPI, createConfig } from '../../test-utils';
import { ConfigManager } from '../../../src/card-controller/config/config-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';

describe('ConfigManager overrides affecting remote_control', () => {
  it('should re-run remote-control loader when overrides change', () => {
    const api = createCardAPI();

    // Use a real ConditionStateManager so that override callbacks fire
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ConfigManager(api);
    vi.mocked(api.getConfigManager).mockReturnValue(manager);

    const config = createConfig({
      remote_control: {
        entities: { camera: 'input_select.camera' },
      },
      overrides: [
        {
          delete: ['remote_control'],
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });

    // Initial set should register remote control automations
    manager.setConfig(config as any);

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();

    // Ensure initial addAutomations contains the remote-control automations
    const initialAdds = vi
      .mocked(api.getAutomationsManager().addAutomations)
      .mock.calls.map((c) => c[0]);
    const hasRemoteControl = initialAdds.some((arr) =>
      arr.some((a: any) =>
        a.conditions?.some(
          (c: any) =>
            c.condition === 'config' &&
            c.paths?.includes('remote_control.entities.camera'),
        ),
      ),
    );
    expect(hasRemoteControl).toBe(true);

    // Trigger the override condition - this should re-run the remote-control
    // loader which will delete automations again and, because the
    // remote_control is removed by the override, it should not re-add them.
    vi.mocked(api.getAutomationsManager().deleteAutomations).mockClear();
    vi.mocked(api.getAutomationsManager().addAutomations).mockClear();

    stateManager.setState({ fullscreen: true });

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();

    // Ensure no subsequent addAutomations contains remote-control automations
    const subsequentAdds = vi
      .mocked(api.getAutomationsManager().addAutomations)
      .mock.calls.map((c) => c[0]);
    const stillHasRemoteControl = subsequentAdds.some((arr) =>
      arr.some((a: any) =>
        a.conditions?.some(
          (c: any) =>
            c.condition === 'config' &&
            c.paths?.includes('remote_control.entities.camera'),
        ),
      ),
    );
    expect(stillHasRemoteControl).toBe(false);
  });
});
