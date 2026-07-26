import { vi } from 'vitest';

import type { CardController } from '../../../src/card-controller/controller';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { createConfig } from '../../config/test-utils';
import {
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createStore,
} from '../../test-utils';

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
