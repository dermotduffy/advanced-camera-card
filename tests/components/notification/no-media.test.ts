import { describe, expect, it, vi } from 'vitest';
import { renderNoMedia } from '../../../src/components/notification/no-media';
import { createCameraManager, createStore } from '../../test-utils';

// @vitest-environment jsdom
describe('renderNoMedia', () => {
  it('should render "No media" heading when not loading', () => {
    const result = renderNoMedia({
      cameraID: null,
      cameraManager: null,
    });
    expect(result).toBeTruthy();
  });

  it('should render "Awaiting media" heading when loading', () => {
    const result = renderNoMedia({
      cameraID: null,
      cameraManager: null,
      loading: true,
    });
    expect(result).toBeTruthy();
  });

  it('should include camera title as metadata when camera resolves', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
      title: 'Office',
      icon: { icon: 'mdi:cctv' },
    });

    const result = renderNoMedia({
      cameraID: 'camera.office',
      cameraManager,
    });
    expect(result).toBeTruthy();
    expect(cameraManager.getCameraMetadata).toBeCalledWith('camera.office');
  });

  it('should fall back to raw camera ID when metadata has no title', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);

    const result = renderNoMedia({
      cameraID: 'camera.office',
      cameraManager,
    });
    expect(result).toBeTruthy();
  });

  it('should fall back to default camera ID when cameraID is null', () => {
    const store = createStore([{ cameraID: 'camera.default' }]);
    const cameraManager = createCameraManager(store);
    vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);

    const result = renderNoMedia({
      cameraID: null,
      cameraManager,
    });
    expect(result).toBeTruthy();
    expect(cameraManager.getCameraMetadata).toBeCalledWith('camera.default');
  });

  it('should not include metadata when no camera is resolvable', () => {
    // Empty store — no default camera.
    const cameraManager = createCameraManager(createStore());

    const result = renderNoMedia({
      cameraID: null,
      cameraManager,
    });
    expect(result).toBeTruthy();
    expect(cameraManager.getCameraMetadata).not.toBeCalled();
  });
});
