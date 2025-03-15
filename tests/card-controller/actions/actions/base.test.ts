import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseAction } from '../../../../src/card-controller/actions/actions/base';
import { createViewAction } from '../../../../src/utils/action';
import { createCardAPI, createHASS, createUser } from '../../../test-utils';

describe('should handle base action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(() => {
    vi.stubGlobal('confirm', vi.fn());
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should construct', async () => {
    const api = createCardAPI();
    const action = new BaseAction(
      {},
      {
        action: 'fire-dom-event',
      },
    );

    await action.execute(api);
    await action.stop();

    // These methods have no observable effect on the base class, so this test is
    // currently only providing coverage and proof of no exceptions!
  });

  it('should not confirm when not necessary', async () => {
    const api = createCardAPI();
    const action = new BaseAction(
      {},
      {
        action: 'fire-dom-event',
      },
    );

    await action.execute(api);

    expect(confirm).not.toBeCalled();
  });

  it('should continue execution when confirmed', async () => {
    const api = createCardAPI();
    const action = new BaseAction(
      {},
      {
        action: 'fire-dom-event',
        confirmation: true,
      },
    );

    vi.mocked(confirm).mockReturnValue(true);

    await action.execute(api);

    expect(confirm).toBeCalled();
  });

  it('should abort execution when not confirmed', async () => {
    const api = createCardAPI();
    const action = new BaseAction(
      {},
      {
        action: 'fire-dom-event',
        confirmation: true,
      },
    );

    vi.mocked(confirm).mockReturnValue(false);

    expect(async () => await action.execute(api)).rejects.toThrowError(/Aborted action/);
  });

  it('should not confirm when exempted', async () => {
    const api = createCardAPI();
    const hass = createHASS({}, createUser({ id: 'user-id' }));
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const action = new BaseAction(
      {},
      {
        action: 'fire-dom-event',
        confirmation: {
          exemptions: [
            {
              user: 'user-id',
            },
          ],
        },
      },
    );

    await action.execute(api);

    expect(confirm).not.toBeCalled();
  });

  describe('should show correct confirmation text', () => {
    it('should show action name in confirmation text', async () => {
      const api = createCardAPI();
      const hass = createHASS({}, createUser({ id: 'user-id' }));
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const action = new BaseAction(
        {},
        {
          action: 'more-info',
          confirmation: true,
        },
      );

      vi.mocked(confirm).mockReturnValue(true);

      await action.execute(api);

      expect(confirm).toBeCalledWith(
        'Are you sure you want to perform this action: more-info',
      );
    });

    it('should show advanced camera card action name in confirmation text', async () => {
      const api = createCardAPI();
      const hass = createHASS({}, createUser({ id: 'user-id' }));
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const action = new BaseAction(
        {},
        {
          ...createViewAction('clips'),
          confirmation: true,
        },
      );

      vi.mocked(confirm).mockReturnValue(true);

      await action.execute(api);

      expect(confirm).toBeCalledWith(
        'Are you sure you want to perform this action: clips',
      );
    });

    it('should show configured confirmation text', async () => {
      const api = createCardAPI();
      const hass = createHASS({}, createUser({ id: 'user-id' }));
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const action = new BaseAction(
        {},
        {
          action: 'more-info',
          confirmation: {
            text: 'Test text',
          },
        },
      );

      vi.mocked(confirm).mockReturnValue(true);

      await action.execute(api);

      expect(confirm).toBeCalledWith('Test text');
    });
  });
});
