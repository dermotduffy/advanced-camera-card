import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionsExecutionRequest } from '../../src/card-controller/actions/types.js';
import { AutomationsManager } from '../../src/card-controller/automations-manager.js';
import { CallSessionState } from '../../src/card-controller/call-manager.js';
import { ConditionStateManager } from '../../src/conditions/state-manager.js';
import { createCardAPI } from '../test-utils.js';

describe('AutomationsManager', () => {
  const createCallState = (state: CallSessionState['state']): CallSessionState => ({
    state,
    lockNavigation: false,
    autoEnableMicrophone: true,
    autoEnableSpeaker: true,
    resumeNormalStreamOnEnd: true,
    endCallOnViewChange: false,
  });

  const actions = [
    {
      action: 'fire-dom-event' as const,
      advanced_camera_card_action: 'clips',
    },
  ];
  const conditions = [{ condition: 'fullscreen' as const, fullscreen: true }];
  const automation = {
    conditions: conditions,
    actions: actions,
  };
  const not_automation = {
    conditions: conditions,
    actions_not: actions,
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

    it('should do nothing with an error message present', () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
      vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
        true,
      );
      vi.mocked(api.getMessageManager().hasErrorMessage).mockReturnValue(true);

      const stateManager = new ConditionStateManager();
      vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

      const automationsManager = new AutomationsManager(api);
      automationsManager.addAutomations([automation]);

      stateManager.setState({ fullscreen: true });

      expect(api.getActionsManager().executeActions).not.toBeCalled();
    });
  });

  it('should execute actions', () => {
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

    // Automation will not re-fire when condition continues to evaluate the
    // same.
    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    stateManager.setState({ fullscreen: false });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(1);

    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(2);
  });

  it('should execute actions_not', () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().hasHASS).mockReturnValue(true);
    vi.mocked(api.getInitializationManager().isInitializedMandatory).mockReturnValue(
      true,
    );
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const automationsManager = new AutomationsManager(api);
    automationsManager.addAutomations([not_automation]);

    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).not.toBeCalled();

    stateManager.setState({ fullscreen: false });
    expect(api.getActionsManager().executeActions).toBeCalled();
  });

  it('should execute actions on call_started and call_ended', () => {
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
        conditions: [{ condition: 'call_started' as const }],
        actions,
      },
      {
        conditions: [{ condition: 'call_ended' as const }],
        actions,
      },
    ]);

    stateManager.setState({ call: createCallState('connecting_call') });
    expect(api.getActionsManager().executeActions).not.toHaveBeenCalled();

    stateManager.setState({ call: createCallState('in_call') });
    expect(api.getActionsManager().executeActions).toHaveBeenNthCalledWith(1, {
      actions,
      triggerData: {
        call: {
          from: 'connecting_call',
          to: 'in_call',
        },
      },
    });

    stateManager.setState({ call: createCallState('ending_call') });
    expect(api.getActionsManager().executeActions).toHaveBeenCalledTimes(1);

    stateManager.setState({ call: createCallState('idle') });
    expect(api.getActionsManager().executeActions).toHaveBeenNthCalledWith(2, {
      actions,
      triggerData: {
        call: {
          from: 'ending_call',
          to: 'idle',
        },
      },
    });
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
        conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
        actions: actions,
      },
      {
        conditions: [{ condition: 'fullscreen' as const, fullscreen: false }],
        actions_not: actions,
      },
    ]);

    // Create a setup where one automation action causes another...
    let fullscreen = true;

    vi.mocked(api.getActionsManager().executeActions).mockImplementation(
      async (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _request: ActionsExecutionRequest,
      ): Promise<void> => {
        fullscreen = !fullscreen;
        stateManager.setState({ fullscreen: fullscreen });
      },
    );

    stateManager.setState({ fullscreen: fullscreen });

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        type: 'error',
        message:
          'Too many nested automation calls, please check your configuration for loops',
      }),
    );

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
        conditions: [{ condition: 'expand' as const, expand: true }],
        actions: actions,
      },
      {
        conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
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

    stateManager.setState({ fullscreen: false });
    stateManager.setState({ fullscreen: true });
    expect(api.getActionsManager().executeActions).toBeCalledTimes(2);
  });
});
