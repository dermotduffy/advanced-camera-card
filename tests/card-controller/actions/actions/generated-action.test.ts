import { describe, expect, it, vi } from 'vitest';

import { GeneratedAction } from '../../../../src/card-controller/actions/actions/generated-action';
import type { TriggerData } from '../../../../src/condition-trigger/triggers/types';
import type { ActionGenerator } from '../../../../src/config/schema/actions/custom/generated-action';
import { createCameraAction, createGeneratedAction } from '../../../../src/utils/action';
import { createCardAPI } from '../../../test-utils';

describe('GeneratedAction', () => {
  it('should run the generated action as a nested action set', async () => {
    const api = createCardAPI();
    const generated = createCameraAction('camera.office');
    const action = new GeneratedAction(
      {},
      createGeneratedAction(() => generated),
    );

    await action.execute(api);

    expect(api.getActionsManager().executeNestedActions).toHaveBeenCalledWith({
      actions: generated,
      config: undefined,
      triggerData: undefined,
    });
  });

  it('should run multiple generated actions when the generator returns several', async () => {
    const api = createCardAPI();
    const generated = [
      createCameraAction('camera.one'),
      createCameraAction('camera.two'),
    ];
    const action = new GeneratedAction(
      {},
      createGeneratedAction(() => generated),
    );

    await action.execute(api);

    expect(api.getActionsManager().executeNestedActions).toHaveBeenCalledWith({
      actions: generated,
      config: undefined,
      triggerData: undefined,
    });
  });

  it('should do nothing when the generator produces nothing', async () => {
    const api = createCardAPI();
    const action = new GeneratedAction(
      {},
      createGeneratedAction(() => null),
    );

    await action.execute(api);

    expect(api.getActionsManager().executeNestedActions).not.toHaveBeenCalled();
  });

  it('should pass the api and trigger data to the generator', async () => {
    const api = createCardAPI();
    const triggerData: TriggerData = {
      platform: 'state',
      entity_id: 'input_select.camera',
    };
    const generator: ActionGenerator = vi.fn(() => null);
    const action = new GeneratedAction(
      {},
      createGeneratedAction(generator),
      undefined,
      triggerData,
    );

    await action.execute(api);

    expect(generator).toHaveBeenCalledWith({ api, triggerData });
  });
});
