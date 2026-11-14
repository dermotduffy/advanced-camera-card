import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  getLastFrameImageConfig,
  LastFrameController,
} from '../../../src/components-lib/live/last-frame-controller';
import type { CameraConfig } from '../../../src/config/schema/cameras';
import type { ImageBaseConfig } from '../../../src/config/schema/common/image';
import type { CapturedFrame, MediaPlayerController } from '../../../src/types';
import {
  getLastFrameKey,
  type LastFrameStore,
} from '../../../src/utils/last-frame-store';
import { callVisibilityHandler, createLitElement } from '../../test-utils';

const DATA_URL = 'data:image/jpeg;base64,AAAA';

const createImageConfig = (mode: ImageBaseConfig['mode']): ImageBaseConfig => ({
  mode,
  refresh_seconds: 'auto',
  last_frame: { max_age_seconds: 86400, show_time: true },
});

interface SetupOptions {
  imageConfig?: ImageBaseConfig | null;
  cameraID?: string | null;
  cameraConfig?: CameraConfig | null;
  isLive?: boolean;
  // Whether the player can capture the frame shown now.
  sync?: boolean;
}

const setup = (options?: SetupOptions) => {
  const store = mock<LastFrameStore>();
  const player = mock<MediaPlayerController>();
  const canvas = document.createElement('canvas');
  const frameOf = (url: string | null): CapturedFrame => ({
    canvas,
    url: Promise.resolve(url),
  });
  const currentScreenshot = vi
    .fn<() => CapturedFrame | null>()
    .mockReturnValue(frameOf(DATA_URL));
  player.captureCurrentFrame = options?.sync ?? true ? currentScreenshot : undefined;

  const state: {
    imageConfig: ImageBaseConfig | null;
    loaded: boolean;
    player: MediaPlayerController | null;
  } = {
    imageConfig:
      options?.imageConfig === undefined
        ? createImageConfig('last_frame')
        : options.imageConfig,
    loaded: true,
    player,
  };

  const host = createLitElement();
  const controller = new LastFrameController(
    host,
    {
      getCameraID: () => (options?.cameraID === undefined ? 'camera' : options.cameraID),
      getCameraConfig: () => options?.cameraConfig ?? null,
      getImageConfig: () => state.imageConfig,
      getMediaPlayerController: () => state.player,
      isLoaded: () => state.loaded,
      isLive: () => options?.isLive ?? true,
    },
    store,
  );
  return { canvas, controller, currentScreenshot, frameOf, host, player, state, store };
};

// The capture is encoded in the background: let it finish.
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const expectStored = (store: LastFrameStore): void => {
  expect(store.set).toHaveBeenCalledWith(
    'camera',
    { url: DATA_URL, capturedAt: expect.any(Date) },
    86400,
  );
};

describe('getLastFrameImageConfig', () => {
  it('should be the configuration in mode last_frame', () => {
    const config = createImageConfig('last_frame');
    expect(getLastFrameImageConfig(config)).toBe(config);
  });

  it('should be null in any other mode, or without one', () => {
    expect(getLastFrameImageConfig(createImageConfig('camera'))).toBeNull();
    expect(getLastFrameImageConfig(undefined)).toBeNull();
  });
});

// @vitest-environment jsdom
describe('LastFrameController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global.document, 'addEventListener');
    vi.spyOn(global.document, 'removeEventListener');
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should register with its host', () => {
    const { controller, host } = setup();
    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should not capture the playing stream periodically', async () => {
    const { controller, currentScreenshot } = setup();
    controller.hostUpdated();

    await vi.advanceTimersByTimeAsync(3600 * 1000);

    expect(currentScreenshot).not.toHaveBeenCalled();
  });

  it('should start on connect, once however often the host updates', () => {
    const { controller } = setup();
    controller.hostConnected();
    controller.hostUpdated();
    controller.hostUpdated();

    expect(document.addEventListener).toHaveBeenCalledTimes(1);
  });

  it("should store under the camera's key, for the configured maximum age", async () => {
    const cameraConfig = { camera_entity: 'camera.a' } as unknown as CameraConfig;
    const { controller, store } = setup({
      cameraConfig,
      imageConfig: {
        ...createImageConfig('last_frame'),
        last_frame: { max_age_seconds: 60, show_time: true },
      },
    });
    controller.hostUpdated();

    await callVisibilityHandler(false);
    await settle();
    expect(store.set).toHaveBeenCalledWith(
      getLastFrameKey('camera', cameraConfig),
      { url: DATA_URL, capturedAt: expect.any(Date) },
      60,
    );
  });

  it('should capture at once when the page is hidden', async () => {
    const { controller, store } = setup();
    controller.hostUpdated();

    await callVisibilityHandler(false);
    await settle();
    expectStored(store);

    store.set.mockClear();
    await callVisibilityHandler(true);
    await settle();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('should capture before the render that unloads the stream', async () => {
    const { controller, currentScreenshot, state, store } = setup();
    controller.hostUpdate();
    await settle();
    expect(store.set).not.toHaveBeenCalled();

    state.loaded = false;
    controller.hostUpdate();
    // Taken in that call, before the render.
    expect(currentScreenshot).toHaveBeenCalledTimes(1);
    await settle();
    expectStored(store);

    // Only on the change.
    store.set.mockClear();
    controller.hostUpdate();
    await settle();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('should capture at once when the host leaves the page, from the last known player', async () => {
    const { controller, currentScreenshot, state, store } = setup();
    controller.hostUpdated();

    // The host's own record of the player is already gone.
    state.player = null;
    controller.hostDisconnected();
    expect(currentScreenshot).toHaveBeenCalledTimes(1);

    await settle();
    expectStored(store);
    expect(document.removeEventListener).toHaveBeenCalledTimes(1);

    // And no older player is used after that.
    store.set.mockClear();
    controller.hostDisconnected();
    await settle();
    expect(store.set).not.toHaveBeenCalled();
    expect(currentScreenshot).toHaveBeenCalledTimes(1);
  });

  it('should stop when the image is no longer in mode last_frame', async () => {
    const { controller, state, store } = setup({
      imageConfig: createImageConfig('last_frame'),
    });
    controller.hostUpdated();

    state.imageConfig = null;
    controller.hostUpdated();
    await vi.advanceTimersByTimeAsync(10 * 1000);

    expect(document.removeEventListener).toHaveBeenCalledTimes(1);
    expect(store.set).not.toHaveBeenCalled();
  });

  it('should keep the drawn frame for its host until cleared', async () => {
    const { canvas, controller, host } = setup();
    controller.hostUpdated();
    expect(controller.getDrawnFrame()).toBeNull();

    await callVisibilityHandler(false);
    expect(controller.getDrawnFrame()).toBe(canvas);
    expect(host.requestUpdate).toHaveBeenCalled();

    controller.clearDrawnFrame();
    expect(controller.getDrawnFrame()).toBeNull();
  });

  it('should keep no drawn frame when none could be taken', async () => {
    const { controller, currentScreenshot, host } = setup();
    currentScreenshot.mockReturnValue(null);
    controller.hostUpdated();

    await callVisibilityHandler(false);

    expect(controller.getDrawnFrame()).toBeNull();
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['no image config in mode last_frame', { imageConfig: null }],
    ['no camera', { cameraID: null }],
    ['a stalled stream', { isLive: false }],
    ['a player that cannot capture at once', { sync: false }],
  ])('should not capture with %s', async (_name, options: SetupOptions) => {
    const { controller, store } = setup(options);
    controller.hostUpdated();

    controller.hostDisconnected();
    await settle();

    expect(store.set).not.toHaveBeenCalled();
  });

  it('should not capture without a player', async () => {
    const { controller, state, store } = setup();
    state.player = null;

    controller.hostDisconnected();
    await settle();

    expect(store.set).not.toHaveBeenCalled();
  });

  it.each([
    ['no screenshot', null],
    ['an empty picture', 'data:,'],
    ['a URL rather than a captured picture', 'https://host/api/camera_proxy/camera.x'],
  ])('should not store %s', async (_name, url) => {
    const { controller, currentScreenshot, frameOf, store } = setup();
    currentScreenshot.mockReturnValue(frameOf(url));

    controller.hostDisconnected();
    await settle();

    expect(store.set).not.toHaveBeenCalled();
  });
});
