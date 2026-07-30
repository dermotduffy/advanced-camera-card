import { expect, vi } from 'vitest';

import type { CardController } from '../../../src/card-controller/controller';
import { applyViewModifiers } from '../../../src/card-controller/view/modifiers';
import type { ViewManagerInterface } from '../../../src/card-controller/view/types';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import type { View } from '../../../src/view/view';
import {
  createCameraManager,
  createCapabilities,
  createStore,
} from '../../camera-manager/test-utils';
import { createConfig } from '../../config/test-utils';
import { createCardAPI } from '../../test-utils';

export const createPopulatedAPI = (
  config?: RawAdvancedCameraCardConfig,
): CardController => {
  const api = createCardAPI();
  const store = createStore([
    {
      cameraID: 'camera.office',
      capabilities: createCapabilities({
        live: true,
        snapshots: true,
        clips: true,
        recordings: true,
        reviews: true,
        substream: true,
      }),
    },
    {
      cameraID: 'camera.kitchen',
      capabilities: createCapabilities({
        live: true,
        snapshots: true,
        clips: true,
        recordings: true,
        reviews: true,
        substream: true,
      }),
    },
  ]);
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));
  return api;
};

// Apply the modifiers from the nth `setViewWithModifiers` call to the given
// view, so that a caller can assert on the resulting view.
export const applySetViewModifiers = (
  viewManager: ViewManagerInterface,
  view: View,
  n = 0,
): View => {
  const mock = vi.mocked(viewManager.setViewWithModifiers).mock;
  expect(mock.calls.length).greaterThan(n);
  return applyViewModifiers(view, mock.calls[n][0]);
};
