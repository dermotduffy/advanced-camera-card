import { afterEach, describe, expect, it, vi } from 'vitest';
import { URLAction } from '../../../../src/card-controller/actions/actions/url';
import { createCardAPI } from '../../../test-utils';

// @vitest-environment jsdom
describe('URLAction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open the URL in a new window', async () => {
    const urlAction = new URLAction(
      {},
      {
        action: 'url',
        url_path: 'https://example.com',
      },
    );
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await urlAction.execute(createCardAPI());

    expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com');
  });
});
