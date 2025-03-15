import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomAction } from '../../../../src/card-controller/actions/actions/custom';
import { createCardAPI } from '../../../test-utils';

// @vitest-environment jsdom
describe('CustomAction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open the URL in a new window', async () => {
    const handler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('ll-custom', handler);

    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);

    const action = new CustomAction(
      {},
      {
        action: 'fire-dom-event' as const,
        foo: 'bar',
        1: 2,
      },
      {},
    );

    await action.execute(api);

    expect(handler).toBeCalledWith(
      expect.objectContaining({
        detail: { action: 'fire-dom-event', foo: 'bar', 1: 2 },
      }),
    );
  });
});
