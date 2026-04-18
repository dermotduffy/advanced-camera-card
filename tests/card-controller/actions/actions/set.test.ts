import { describe, expect, it, vi } from 'vitest';
import { ActionSet } from '../../../../src/card-controller/actions/actions/set';
import { createLogAction } from '../../../../src/utils/action';
import { createCardAPI } from '../../../test-utils';

describe('ActionSet', () => {
  it('should execute single action', async () => {
    const api = createCardAPI();

    const set = new ActionSet({}, createLogAction('Hello, world!'));

    const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
    await set.execute(api);
    expect(consoleSpy).toBeCalled();
  });

  it('should not execute invalid action', async () => {
    const api = createCardAPI();
    const set = new ActionSet(
      {},
      createLogAction('Hello, world!', {
        cardID: 'another-card',
      }),
    );

    const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
    await set.execute(api);
    expect(consoleSpy).not.toBeCalled();
  });

  it('should stop execution', async () => {
    const api = createCardAPI();

    const set = new ActionSet({}, createLogAction('Hello, world!'));

    const consoleSpy = vi.spyOn(global.console, 'info').mockReturnValue(undefined);
    await set.stop();
    await set.execute(api);
    expect(consoleSpy).not.toBeCalled();
  });
});
