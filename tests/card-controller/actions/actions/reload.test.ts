import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ReloadAction } from '../../../../src/card-controller/actions/actions/reload';
import { createCardAPI } from '../../../test-utils';

// @vitest-environment jsdom
describe('should handle reload action', async () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle reload action', async () => {
    const api = createCardAPI();
    const action = new ReloadAction(
      {},
      {
        action: 'fire-dom-event',
        advanced_camera_card_action: 'reload',
      },
    );

    const location: Location & { origin: string } = mock<Location>();
    vi.spyOn(window, 'location', 'get').mockReturnValue(location);

    await action.execute(api);

    expect(location.reload).toBeCalledTimes(1);
  });
});
