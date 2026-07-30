import { describe, expect, it, vi } from 'vitest';

import { EffectAction } from '../../../../src/card-controller/actions/actions/effect';
import { createEffectAction } from '../../../../src/utils/action';
import { createCardAPI } from '../../../test-utils';

describe('EffectAction', () => {
  it('should call startEffect when action is start', async () => {
    const api = createCardAPI();
    vi.mocked(api.getEffectsManager().startEffect).mockResolvedValue(undefined);
    const actionConfig = createEffectAction('snow', 'start');
    const action = new EffectAction({}, actionConfig);

    await action.execute(api);

    expect(api.getEffectsManager().startEffect).toHaveBeenCalledWith('snow');
  });

  it('should call stopEffect when action is stop', async () => {
    const api = createCardAPI();
    const actionConfig = createEffectAction('snow', 'stop');
    const action = new EffectAction({}, actionConfig);

    await action.execute(api);

    expect(api.getEffectsManager().stopEffect).toHaveBeenCalledWith('snow');
  });

  it('should call toggleEffect when action is toggle', async () => {
    const api = createCardAPI();
    vi.mocked(api.getEffectsManager().toggleEffect).mockResolvedValue(undefined);
    const actionConfig = createEffectAction('snow', 'toggle');
    const action = new EffectAction({}, actionConfig);

    await action.execute(api);

    expect(api.getEffectsManager().toggleEffect).toHaveBeenCalledWith('snow');
  });

  it('should tolerate a failure to start the effect', async () => {
    const api = createCardAPI();
    vi.mocked(api.getEffectsManager().startEffect).mockRejectedValue(new Error());
    const actionConfig = createEffectAction('snow', 'start');
    const action = new EffectAction({}, actionConfig);

    await expect(action.execute(api)).resolves.toBeUndefined();
  });

  it('should tolerate a failure to toggle the effect', async () => {
    const api = createCardAPI();
    vi.mocked(api.getEffectsManager().toggleEffect).mockRejectedValue(new Error());
    const actionConfig = createEffectAction('snow', 'toggle');
    const action = new EffectAction({}, actionConfig);

    await expect(action.execute(api)).resolves.toBeUndefined();
  });

  it('should have a no-op stop method', async () => {
    const actionConfig = createEffectAction('snow', 'stop');
    const action = new EffectAction({}, actionConfig);

    await expect(action.stop()).resolves.toBeUndefined();
  });
});
