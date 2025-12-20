import { describe, expect, it, vi } from 'vitest';
import { createCardAPI, createConfig, flushPromises } from '../../test-utils';
import { ConfigManager } from '../../../src/card-controller/config/config-manager';
import { ConditionStateManager } from '../../../src/conditions/state-manager';
import { setKeyboardShortcutsFromConfig } from '../../../src/card-controller/config/load-keyboard-shortcuts';

describe('ConfigManager override responses for loaders', () => {
  it('should re-run keyboard-shortcuts loader when overrides change', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ConfigManager(api);
    vi.mocked(api.getConfigManager).mockReturnValue(manager);

    const config = createConfig({
      view: {
        keyboard_shortcuts: {
          enabled: true,
          ptz_home: { key: 'h' },
        },
      },
      overrides: [
        {
          delete: ['view.keyboard_shortcuts'],
          conditions: [
            {
              condition: 'fullscreen' as const,
              fullscreen: true,
            },
          ],
        },
      ],
    });

    manager.setConfig(config as any);

    // Verify the initial automation payload created by keyboard shortcuts
    const initialAddCalls = vi.mocked(api.getAutomationsManager().addAutomations).mock
      .calls;
    expect(initialAddCalls.length).toBeGreaterThan(0);
    const added = initialAddCalls[0][0];
    // The keyboard shortcuts loader may add multiple automations (defaults
    // and configured). Ensure at least one automation matches our expected
    // keyboard shortcut for `h`.
    expect(added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conditions: expect.arrayContaining([
            expect.objectContaining({ condition: 'key', key: 'h' }),
          ]),
          actions: expect.arrayContaining([
            expect.objectContaining({
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_multi',
            }),
          ]),
        }),
      ]),
    );

    // Clear prior calls so we can assert calls caused by the override only
    vi.mocked(api.getAutomationsManager().deleteAutomations).mockClear();
    vi.mocked(api.getAutomationsManager().addAutomations).mockClear();

    // Clear prior calls and trigger the override via the state manager.
    vi.mocked(api.getAutomationsManager().deleteAutomations).mockClear();
    vi.mocked(api.getAutomationsManager().addAutomations).mockClear();

    stateManager.setState({ fullscreen: true });
    await flushPromises();

    // Ensure keyboard shortcut automation is no longer added after the
    // override.
    const addCalls = vi.mocked(api.getAutomationsManager().addAutomations).mock.calls;
    const hasH = addCalls.some((c) =>
      c[0].some((a: any) =>
        a.conditions?.some((cond: any) => cond.condition === 'key' && cond.key === 'h'),
      ),
    );
    expect(hasH).toBe(false);
  });

  it('should re-run folders loader when overrides change', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ConfigManager(api);
    vi.mocked(api.getConfigManager).mockReturnValue(manager);

    const folders = [{ id: 'f' }];
    const config = createConfig({
      folders,
      overrides: [
        {
          delete: ['folders'],
          conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
        },
      ],
    });

    manager.setConfig(config as any);

    // Verify initial payload (folders may be populated with defaults, so
    // assert the passed folders contain our folder id).
    expect(api.getFoldersManager().addFolders).toHaveBeenCalled();
    expect(api.getFoldersManager().addFolders).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'f' })]),
    );

    // Reset calls so we only see calls resulting from the override
    vi.mocked(api.getFoldersManager().deleteFolders).mockClear();
    vi.mocked(api.getFoldersManager().addFolders).mockClear();

    stateManager.setState({ fullscreen: true });
    await flushPromises();

    expect(api.getFoldersManager().deleteFolders).toBeCalled();
    // Since the override removes folders, the folders passed should no
    // longer include our folder `f`.
    const calls = vi.mocked(api.getFoldersManager().addFolders).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const lastArg = calls[calls.length - 1][0] as unknown[];
    expect(lastArg).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'f' })]),
    );
  });

  it('should re-run automations loader when overrides change', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const manager = new ConfigManager(api);
    vi.mocked(api.getConfigManager).mockReturnValue(manager);

    const automation = {
      conditions: [],
      actions: [
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'log',
          message: 'test',
        },
      ],
    };
    const config = createConfig({
      automations: [automation],
      overrides: [
        {
          delete: ['automations'],
          conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
        },
      ],
    });

    manager.setConfig(config as any);

    // Verify initial payload produced by automations loader
    expect(api.getAutomationsManager().addAutomations).toBeCalledWith([automation]);

    // Clear to observe only calls caused by the override
    vi.mocked(api.getAutomationsManager().deleteAutomations).mockClear();
    vi.mocked(api.getAutomationsManager().addAutomations).mockClear();

    // The automations loader should be invoked when overrides change. Spy on
    // the loader function to ensure it is called (the AutomationsManager
    // calls may be performed elsewhere).
    const loaders = await import('../../../src/card-controller/config/load-automations');
    const spy = vi.spyOn(loaders, 'setAutomationsFromConfig');

    // Trigger override processing directly
    stateManager.setState({ fullscreen: true });
    await flushPromises();

    expect(spy).toBeCalled();
  });
});
