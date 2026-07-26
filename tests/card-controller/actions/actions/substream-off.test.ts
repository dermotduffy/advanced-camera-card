import { describe, expect, it, vi } from 'vitest';

import { SubstreamOffAction } from '../../../../src/card-controller/actions/actions/substream-off';
import { applyViewModifiers } from '../../../../src/card-controller/view/modifiers';
import { createSubstreamOffAction } from '../../../../src/utils/action';
import type { View } from '../../../../src/view/view';
import { createCardAPI } from '../../../test-utils';
import { createView } from '../../../view/test-utils';

// Runs the off-action for `view` and applies the modifier it produces.
const applySubstreamOff = async (
  view: View,
  options?: { camera?: string },
): Promise<void> => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(view);

  await new SubstreamOffAction({}, createSubstreamOffAction(options)).execute(api);

  const params = vi.mocked(api.getViewManager().setViewByParameters).mock.calls[0]?.[0];
  applyViewModifiers(view, params?.modifiers);
};

describe('SubstreamOffAction', () => {
  it('should clear the selected camera override', async () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
      context: {
        live: { overrides: new Map([['camera.office', 'camera.kitchen']]) },
      },
    });

    await applySubstreamOff(view);

    expect(view.context?.live?.overrides?.get('camera.office')).toBeUndefined();
  });

  it('should clear an explicit camera override', async () => {
    const view = createView({
      view: 'live',
      camera: 'camera.driveway',
      context: {
        live: {
          overrides: new Map([
            ['camera.office', 'camera.kitchen'],
            ['camera.driveway', 'camera.driveway_hd'],
          ]),
        },
      },
    });

    await applySubstreamOff(view, { camera: 'camera.office' });

    expect(view.context?.live?.overrides?.get('camera.office')).toBeUndefined();
    expect(view.context?.live?.overrides?.get('camera.driveway')).toBe(
      'camera.driveway_hd',
    );
  });
});
