import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionsExecutionRequest } from '../../src/card-controller/actions/types.js';
import { AutomationsManager } from '../../src/card-controller/automations-manager.js';
import { ConditionStateManager } from '../../src/condition-trigger/conditions/state-manager.js';
import { createCardAPI, flushPromises } from '../test-utils.js';

describe('AutomationsManager', () => {
  const actions = [
    {
      action: 'fire-dom-event' as const,
      advanced_camera_card_action: 'clips',
    },
  ];
  const triggers = [{ trigger: 'fullscreen' as const, fullscreen: true }];
  const automation = {
    triggers: triggers,
    actions: actions,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('should not execute actions', () => {
    it('should do nothing without hass', () => {
      const api = createCardAPI();
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const automationsManager = new AutomationsManager(api);
      automationsManager.addAutomations([automation]);

      stateManager.setState({ fullscreen: true });

      expect(api.getActionsManager().executeActions).not.toBeCalled();
    });

    it('should do nothing without being initialized', () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
      vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
        false,
      );
      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const automationsManager = new AutomationsManager(api);
      automationsManager.addAutomations([automation]);

      stateManager.setState({ fullscreen: true });

      expect(api.getActionsManager().executeActions).not.toBeCalled();
    });

    it('should do nothing when an issue is present', () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
      vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
        true,
      );
      vi.mocked(
        api.getIssueManager().getStateManager().hasFullCardIssue,
      ).mockReturnValue(true);

      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const automationsManager = new AutomationsManager(api);
      automationsManager.addAutomations([automation]);

      stateManager.setState({ fullscreen: true });

      expect(api.getActionsManager().executeActions).not.toBeCalled();
    });
  });

  it('should execute actions when triggered', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([automation]);

    stateManager.setState({ fullscreen: true });

    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    // It does not re-trigger while its source stays in the same state.
    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    stateManager.setState({ fullscreen: false });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(2);
  });

  it('should run actions when the ongoing conditions hold', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([
      {
        triggers: triggers,
        conditions: [{ condition: 'expand' as const, expand: true }],
        actions: actions,
      },
    ]);

    // The ongoing condition holds when triggered, so `actions` run.
    stateManager.setState({ expand: true });
    stateManager.setState({ fullscreen: true });

    expect(api.getActionsManager().executeActions).toBeCalledWith({
      actions: actions,
      triggerData: { platform: 'acc', type: 'fullscreen' },
    });
  });

  it('should do nothing when the ongoing conditions do not hold', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([
      {
        triggers: triggers,
        conditions: [{ condition: 'expand' as const, expand: true }],
        actions: actions,
      },
    ]);

    // The automation is triggered but the ongoing condition does not hold, so
    // nothing runs.
    stateManager.setState({ fullscreen: true });

    expect(api.getActionsManager().executeActions).not.toBeCalled();
  });

  it('should do nothing when the actions are empty', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([
      {
        triggers: triggers,
        actions: [],
      },
    ]);

    stateManager.setState({ fullscreen: true });

    expect(api.getActionsManager().executeActions).not.toBeCalled();
  });

  it('should prevent automation loops', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([
      {
        triggers: [{ trigger: 'camera' as const }],
        actions: actions,
      },
    ]);

    // Create a setup where the automation's action re-triggers itself: the camera
    // trigger responds to every camera change, and the action changes the camera,
    // looping until the nested-execution guard trips.
    let camera = 'one';

    vi.mocked(api.getActionsManager().executeActions).mockImplementation(
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _request: ActionsExecutionRequest,
      ): Promise<void> => {
        camera = camera === 'one' ? 'two' : 'one';
        stateManager.setState({ camera: camera });
      },
    );

    stateManager.setState({ camera: camera });

    expect(api.getNotificationManager().setNotification).toBeCalledWith({
      heading: {
        text: 'Too many nested automation calls, please check your configuration for loops',
        icon: 'mdi:alert',
        severity: 'high',
      },
    });

    expect(api.getActionsManager().executeActions).toBeCalledTimes(10);
  });

  it('should reset the nested-execution counter after an overflow', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([
      {
        triggers: [{ trigger: 'camera' as const }],
        actions: actions,
      },
    ]);

    // As in the loop test: the action changes the camera, re-triggering itself
    // until the nested-execution guard trips.
    let camera = 'one';
    vi.mocked(api.getActionsManager().executeActions).mockImplementation(
      async (): Promise<void> => {
        camera = camera === 'one' ? 'two' : 'one';
        stateManager.setState({ camera: camera });
      },
    );

    stateManager.setState({ camera: camera });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(10);

    // The counter is decremented on the microtasks that resume after each
    // awaited execution, so let them drain before the next batch.
    await flushPromises();

    vi.mocked(api.getActionsManager().executeActions).mockClear();

    // A second, independent change overflows afresh and reaches the full limit
    // again -- only possible if the counter returned to zero. A leaked counter
    // (overflow returning without decrementing) would cut this batch short.
    stateManager.setState({ camera: 'three' });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(10);
  });

  it('should delete automations', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([
      {
        triggers: [{ trigger: 'expand' as const, expand: true }],
        actions: actions,
      },
      {
        triggers: [{ trigger: 'fullscreen' as const, fullscreen: true }],
        actions: actions,
        tag: 'fullscreen',
      },
    ]);

    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    // Delete the fullscreen automation.
    automationsManager.deleteAutomations('fullscreen');

    stateManager.setState({ fullscreen: false });
    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    stateManager.setState({ expand: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(2);

    // Delete all automations.
    automationsManager.deleteAutomations();

    stateManager.setState({ expand: false });
    stateManager.setState({ expand: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(2);
  });
});
