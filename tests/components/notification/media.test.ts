import { describe, expect, it, vi } from 'vitest';

import { renderNoMediaNotification } from '../../../src/components/notification/media';
import { createCameraManager, createStore } from '../../camera-manager/test-utils';

// @vitest-environment jsdom
describe('renderNoMediaNotification', () => {
  it('should render the no-media block when not loading', () => {
    expect(renderNoMediaNotification({ cameraID: null })).toBeTruthy();
  });

  it('should render the awaiting-media block when loading', () => {
    expect(renderNoMediaNotification({ cameraID: null, inProgress: true })).toBeTruthy();
  });

  it('should resolve the camera title from the manager', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
      title: 'Office',
      icon: { icon: 'mdi:cctv' },
    });

    expect(
      renderNoMediaNotification({ cameraID: 'camera.office' }, cameraManager),
    ).toBeTruthy();
    expect(cameraManager.getCameraMetadata).toBeCalledWith('camera.office');
  });

  it('should fall back to the raw camera ID when metadata has no title', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);

    expect(
      renderNoMediaNotification({ cameraID: 'camera.office' }, cameraManager),
    ).toBeTruthy();
  });

  it('should fall back to the default camera when cameraID is null', () => {
    const cameraManager = createCameraManager(
      createStore([{ cameraID: 'camera.default' }]),
    );
    vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);

    expect(renderNoMediaNotification({ cameraID: null }, cameraManager)).toBeTruthy();
    expect(cameraManager.getCameraMetadata).toBeCalledWith('camera.default');
  });

  it('should not resolve a title when no camera is resolvable', () => {
    const cameraManager = createCameraManager(createStore());

    expect(renderNoMediaNotification({ cameraID: null }, cameraManager)).toBeTruthy();
    expect(cameraManager.getCameraMetadata).not.toBeCalled();
  });
});
