import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraURLManager } from '../../src/card-controller/camera-url-manager';
import { CardCameraURLAPI } from '../../src/card-controller/types';
import { Endpoint } from '../../src/types';
import { createCardAPI, createViewWithMedia } from '../test-utils';

const createAPIWithMedia = (): CardCameraURLAPI => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(createViewWithMedia());
  return api;
};

// @vitest-environment jsdom
describe('CameraURLManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should get URL', () => {
    const api = createAPIWithMedia();
    const manager = new CameraURLManager(api);

    const endpoint: Endpoint = {
      endpoint: 'http://frigate',
    };

    vi.mocked(api.getCameraManager().getCameraEndpoints)?.mockReturnValue({
      ui: endpoint,
    });

    expect(manager.getCameraURL()).toBe('http://frigate');
    expect(manager.hasCameraURL()).toBeTruthy();

    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    manager.openURL();
    expect(windowSpy).toBeCalledWith('http://frigate');
  });

  it('should not get URL without view', () => {
    const manager = new CameraURLManager(createCardAPI());
    expect(manager.getCameraURL()).toBeNull();

    const windowSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    manager.openURL();
    expect(windowSpy).not.toBeCalled();
  });

  it('should not get URL without cameraManager endpoints', () => {
    const api = createAPIWithMedia();
    vi.mocked(api.getCameraManager().getCameraEndpoints)?.mockReturnValue(null);
    const manager = new CameraURLManager(api);
    expect(manager.getCameraURL()).toBeNull();
  });
});
