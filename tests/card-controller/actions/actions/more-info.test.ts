import { describe, expect, it, vi } from 'vitest';
import { MoreInfoAction } from '../../../../src/card-controller/actions/actions/more-info';
import { createCardAPI } from '../../../test-utils';

// @vitest-environment jsdom
describe('should handle more-info action', () => {
  it('should handle more-info with entity in action', async () => {
    const handler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('hass-more-info', handler);

    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

    const action = new MoreInfoAction(
      {},
      {
        action: 'more-info',
        entity: 'light.office',
      },
      {},
    );

    await action.execute(api);

    expect(handler).toBeCalledWith(
      expect.objectContaining({
        detail: { entityId: 'light.office' },
      }),
    );
  });

  it('should handle more-info with entity in auxilliary config', async () => {
    const handler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('hass-more-info', handler);

    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

    const action = new MoreInfoAction(
      {},
      {
        action: 'more-info',
      },
      {
        entity: 'light.office',
      },
    );

    await action.execute(api);

    expect(handler).toBeCalledWith(
      expect.objectContaining({
        detail: { entityId: 'light.office' },
      }),
    );
  });

  it('should take no action with any entity', async () => {
    const handler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('hass-more-info', handler);

    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

    const action = new MoreInfoAction(
      {},
      {
        action: 'more-info',
      },
      {},
    );

    await action.execute(api);

    expect(handler).not.toBeCalled();
  });
});
