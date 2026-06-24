import { describe, expect, it, vi } from 'vitest';

import { IfAction } from '../../../../src/card-controller/actions/actions/if';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { createCardAPI } from '../../../test-utils';

const thenActions = [
  {
    action: 'fire-dom-event' as const,
    advanced_camera_card_action: 'clips' as const,
  },
];
const elseActions = [
  {
    action: 'fire-dom-event' as const,
    advanced_camera_card_action: 'clip' as const,
  },
];

describe('IfAction', () => {
  it('should run the then branch when the conditions hold', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    stateManager.setState({ fullscreen: true });
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const action = new IfAction(
      {},
      {
        if: [{ condition: 'fullscreen', fullscreen: true }],
        then: thenActions,
        else: elseActions,
      },
    );

    await action.execute(api);

    expect(api.getActionsManager().executeActions).toBeCalledWith({
      actions: thenActions,
      config: undefined,
      triggerData: undefined,
    });
  });

  it('should run the else branch when the conditions do not hold', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    stateManager.setState({ fullscreen: false });
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const action = new IfAction(
      {},
      {
        if: [{ condition: 'fullscreen', fullscreen: true }],
        then: thenActions,
        else: elseActions,
      },
    );

    await action.execute(api);

    expect(api.getActionsManager().executeActions).toBeCalledWith({
      actions: elseActions,
      config: undefined,
      triggerData: undefined,
    });
  });

  it('should do nothing when the conditions do not hold and there is no else branch', async () => {
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    stateManager.setState({ fullscreen: false });
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const action = new IfAction(
      {},
      {
        if: [{ condition: 'fullscreen', fullscreen: true }],
        then: thenActions,
      },
    );

    await action.execute(api);

    expect(api.getActionsManager().executeActions).not.toBeCalled();
  });
});
