import { describe, expect, it, vi } from 'vitest';
import { EffectAction } from '../../../../src/card-controller/actions/actions/effect';
import { createEffectAction } from '../../../../src/utils/action';
import { createCardAPI } from '../../../test-utils';

describe('EffectAction', () => {
  it('should call startEffect when action is start', async () => {
    const api = createCardAPI();
    const actionConfig = createEffectAction('snow', 'start');
    const action = new EffectAction({}, actionConfig);

    await action.execute(api);

    expect(api.getEffectsControllerAPI()?.startEffect).toHaveBeenCalledWith('snow');
  });

  it('should call stopEffect when action is stop', async () => {
    const api = createCardAPI();
    const actionConfig = createEffectAction('snow', 'stop');
    const action = new EffectAction({}, actionConfig);

    await action.execute(api);

    expect(api.getEffectsControllerAPI()?.stopEffect).toHaveBeenCalledWith('snow');
  });

  it('should call toggleEffect when action is toggle', async () => {
    const api = createCardAPI();
    const actionConfig = createEffectAction('snow', 'toggle');
    const action = new EffectAction({}, actionConfig);

    await action.execute(api);

    expect(api.getEffectsControllerAPI()?.toggleEffect).toHaveBeenCalledWith('snow');
  });

  it('should not throw when effectsControllerAPI is null', async () => {
    const api = createCardAPI();
    vi.mocked(api.getEffectsControllerAPI).mockReturnValue(null);
    const actionConfig = createEffectAction('snow', 'start');
    const action = new EffectAction({}, actionConfig);

    await expect(action.execute(api)).resolves.toBeUndefined();
  });

  it('should have a no-op stop method', async () => {
    const actionConfig = createEffectAction('snow', 'stop');
    const action = new EffectAction({}, actionConfig);

    await expect(action.stop()).resolves.toBeUndefined();
  });
});

