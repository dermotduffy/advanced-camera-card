import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { LastFrameImageController } from '../../src/components-lib/last-frame-image-controller';
import type { CameraConfig } from '../../src/config/schema/cameras';
import type { ImageBaseConfig } from '../../src/config/schema/common/image';
import { getLastFrameKey, type LastFrameStore } from '../../src/utils/last-frame-store';
import { createLitElement } from '../test-utils';

const FRAME = { url: 'data:image/jpeg;base64,AAAA', capturedAt: new Date(1000) };

const createImageConfig = (): ImageBaseConfig => ({
  mode: 'last_frame',
  refresh_seconds: 'auto',
  last_frame: { max_age_seconds: 86400, show_time: true },
});

const setup = (options?: {
  cameraID?: string | null;
  cameraConfig?: CameraConfig | null;
  imageConfig?: ImageBaseConfig | null;
}) => {
  const store = mock<LastFrameStore>();
  let listener: ((cameraID: string) => void) | null = null;
  const unsubscribe = vi.fn();
  store.subscribe.mockImplementation((callback) => {
    listener = callback;
    return unsubscribe;
  });
  const onChange = vi.fn();
  const host = createLitElement();
  const controller = new LastFrameImageController(
    host,
    {
      getCameraID: () => (options?.cameraID === undefined ? 'camera' : options.cameraID),
      getCameraConfig: () => options?.cameraConfig ?? null,
      getImageConfig: () =>
        options?.imageConfig === undefined ? createImageConfig() : options.imageConfig,
      onChange,
    },
    store,
  );
  const notify = (cameraID: string): void => listener?.(cameraID);
  return { controller, host, notify, onChange, store, unsubscribe };
};

// @vitest-environment jsdom
describe('LastFrameImageController', () => {
  it('should register with its host', () => {
    const { controller, host } = setup();
    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should tell of a new frame for its camera only, while connected', () => {
    const { controller, notify, onChange, unsubscribe } = setup();
    controller.hostConnected();

    notify('other');
    expect(onChange).not.toHaveBeenCalled();
    notify('camera');
    expect(onChange).toHaveBeenCalledTimes(1);

    controller.hostDisconnected();
    expect(unsubscribe).toHaveBeenCalled();
    controller.hostDisconnected();
  });

  it('should not tell of frames outside mode last_frame', () => {
    const { controller, notify, onChange } = setup({ imageConfig: null });
    controller.hostConnected();

    notify('camera');

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should give the camera's frame", () => {
    const { controller, store } = setup();
    store.get.mockReturnValue(FRAME);

    expect(controller.getLastFrame()).toBe(FRAME);
  });

  it.each([
    ['without a camera', { cameraID: null }],
    ['outside mode last_frame', { imageConfig: null }],
  ])('should give no frame %s', (_name, options) => {
    const { controller, store } = setup(options);
    store.get.mockReturnValue(FRAME);

    expect(controller.getLastFrame()).toBeNull();
  });

  it("should use the camera's configuration in its key", () => {
    const cameraConfig = { camera_entity: 'camera.a' } as unknown as CameraConfig;
    const { controller, notify, onChange, store } = setup({ cameraConfig });
    const key = getLastFrameKey('camera', cameraConfig);
    controller.hostConnected();

    notify('camera');
    expect(onChange).not.toHaveBeenCalled();
    notify(key);
    expect(onChange).toHaveBeenCalledTimes(1);

    controller.getLastFrame();
    expect(store.get).toHaveBeenCalledWith(key);
  });
});
