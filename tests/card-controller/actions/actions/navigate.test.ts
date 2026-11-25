import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { NavigateAction } from '../../../../src/card-controller/actions/actions/navigate';
import { createCardAPI } from '../../../test-utils';

// @vitest-environment jsdom
describe('should handle navigate action', () => {
  beforeEach(() => {
    const href = location.href;
    onTestFinished(() => history.replaceState(null, '', href));
  });

  it('should handle navigate action', async () => {
    const handler = vi.fn();
    window.addEventListener('location-changed', handler);
    onTestFinished(() => window.removeEventListener('location-changed', handler));

    const action = new NavigateAction(
      {},
      {
        action: 'navigate',
        navigation_path: '/path',
      },
      {},
    );

    const historyLength = history.length;

    await action.execute(createCardAPI());

    expect(history.length).toBe(historyLength + 1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { replace: false },
      }),
    );
  });

  it('should handle navigate action that replaces', async () => {
    const handler = vi.fn();
    window.addEventListener('location-changed', handler);
    onTestFinished(() => window.removeEventListener('location-changed', handler));

    const action = new NavigateAction(
      {},
      {
        action: 'navigate',
        navigation_path: '/path',
        navigation_replace: true,
      },
      {},
    );

    const historyLength = history.length;

    await action.execute(createCardAPI());

    expect(history.length).toBe(historyLength);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { replace: true },
      }),
    );
  });
});
