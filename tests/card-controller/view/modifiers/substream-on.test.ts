import { describe, expect, it, vi } from 'vitest';
import { CardController } from '../../../../src/card-controller/controller';
import { SubstreamOnViewModifier } from '../../../../src/card-controller/view/modifiers/substream-on';
import { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import {
  getStreamCameraID,
  hasSubstream,
  setSubstream,
} from '../../../../src/utils/substream';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createStore,
  createView,
} from '../../../test-utils';

const createAPIWithSubstreams = (
  config?: RawAdvancedCameraCardConfig,
): CardController => {
  const api = createCardAPI();
  const store = createStore([
    {
      cameraID: 'camera.office',
      capabilities: createCapabilities({
        live: true,
        substream: true,
      }),
      config: createCameraConfig({
        dependencies: {
          all_cameras: true,
        },
      }),
    },
    {
      cameraID: 'camera.kitchen',
      capabilities: createCapabilities({
        substream: true,
      }),
    },
  ]);
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager(store));
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));
  return api;
};

describe('should turn on substream', () => {
  it('substream available', () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
    });

    expect(hasSubstream(view)).toBe(false);

    const api = createAPIWithSubstreams();

    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(true);
    expect(getStreamCameraID(view)).toBe('camera.kitchen');

    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
    expect(getStreamCameraID(view)).toBe('camera.office');
  });

  it('malformed substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
    });

    const api = createAPIWithSubstreams();

    setSubstream(view, 'NOT_A_REAL_CAMERA');

    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
    expect(getStreamCameraID(view)).toBe('camera.office');
  });

  it('substream unavailable', () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
    });

    expect(hasSubstream(view)).toBe(false);

    const api = createCardAPI();
    const cameraManager = createCameraManager(createStore([]));
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
  });

  it('without camera', () => {
    const view = createView({
      camera: null,
      view: 'live',
    });

    const api = createCardAPI();
    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
  });
});
