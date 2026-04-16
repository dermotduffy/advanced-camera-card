import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CallManager } from '../../src/card-controller/call-manager';
import { CallClearStateViewModifier } from '../../src/card-controller/view/modifiers/call-clear-state';
import { MediaPlayerController } from '../../src/types';
import {
  createCameraConfig,
  createCardAPI,
  createMediaLoadedInfo,
  createStore,
  createView,
} from '../test-utils';

// @vitest-environment jsdom
describe('CallManager', () => {
  it('should start a call and transition into an active session', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            live_provider: 'go2rtc',
            call_mode: {
              enabled: true,
              stream: 'doorbell',
              auto_enable_microphone: true,
              auto_enable_speaker: true,
              lock_navigation: true,
            },
          }),
        },
      ]),
    );
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({ mediaPlayerController }),
    );

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(true);

    expect(mediaPlayerController.mute).toBeCalled();
    expect(api.getViewManager().setViewByParameters).toBeCalledWith(
      expect.objectContaining({
        ignoreNavigationLock: true,
        modifiers: expect.any(Array),
      }),
    );
    expect(manager.getState()).toMatchObject({
      state: 'connecting_call',
      camera: 'camera-1',
      stream: 'doorbell',
      lockNavigation: true,
    });

    await manager.onMediaLoaded(createMediaLoadedInfo({ mediaPlayerController }));

    expect(mediaPlayerController.unmute).toBeCalled();
    expect(api.getMicrophoneManager().unmute).toBeCalled();
    expect(manager.getState().state).toBe('in_call');

    await expect(manager.endCall()).resolves.toBe(true);

    expect(api.getMicrophoneManager().mute).toBeCalled();
    expect(api.getMicrophoneManager().disconnect).toBeCalled();
    expect(manager.getState().state).toBe('ending_call');

    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-1',
    );

    expect(manager.getState().state).toBe('idle');
  });

  it('should reject call mode outside the live view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'clips' }),
    );

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        type: 'error',
        icon: 'mdi:phone-off',
      }),
    );
    expect(manager.getState().state).toBe('idle');
  });

  it('should reject unsupported live providers', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            live_provider: 'ha',
            call_mode: {
              enabled: true,
              stream: 'doorbell',
            },
          }),
        },
      ]),
    );

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalled();
    expect(api.getMicrophoneManager().disconnect).toBeCalled();
    expect(manager.isActive()).toBe(false);
  });

  it('should preserve the call stream on manual end when configured', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            live_provider: 'go2rtc',
            call_mode: {
              enabled: true,
              stream: 'doorbell',
              resume_normal_stream_on_end: false,
            },
          }),
        },
      ]),
    );
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({ mediaPlayerController }),
    );

    const manager = new CallManager(api);
    await manager.startCall();

    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    await expect(manager.endCall()).resolves.toBe(true);

    const calls = vi.mocked(api.getViewManager().setViewByParameters).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[0]).toEqual(
      expect.objectContaining({
        modifiers: expect.arrayContaining([expect.any(CallClearStateViewModifier)]),
      }),
    );
  });

  it('should ignore media events for other cameras while connecting', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            live_provider: 'go2rtc',
            call_mode: {
              enabled: true,
              stream: 'doorbell',
            },
          }),
        },
      ]),
    );
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({ mediaPlayerController }),
    );

    const manager = new CallManager(api);
    await manager.startCall();
    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-2',
    );

    expect(manager.getState().state).toBe('connecting_call');
    expect(mediaPlayerController.unmute).not.toBeCalled();

    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-1',
    );

    expect(manager.getState().state).toBe('in_call');
  });

  it('should roll back a failed call setup on live errors', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            live_provider: 'go2rtc',
            call_mode: {
              enabled: true,
              stream: 'doorbell',
            },
          }),
        },
      ]),
    );
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({ mediaPlayerController }),
    );

    const manager = new CallManager(api);
    await manager.startCall();
    await manager.onLiveError('camera-1');

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        type: 'error',
        icon: 'mdi:phone-off',
      }),
    );
    expect(api.getMicrophoneManager().disconnect).toBeCalled();
    expect(manager.getState().state).toBe('idle');
  });

  it('should remain ending_call until the normal stream reloads', async () => {
    const api = createCardAPI();
    const mediaPlayerController = mock<MediaPlayerController>();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: createCameraConfig({
            live_provider: 'go2rtc',
            call_mode: {
              enabled: true,
              stream: 'doorbell',
              resume_normal_stream_on_end: true,
            },
          }),
        },
      ]),
    );
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({ mediaPlayerController }),
    );

    const manager = new CallManager(api);
    await manager.startCall();
    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-1',
    );

    await manager.endCall();

    expect(manager.getState().state).toBe('ending_call');

    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-2',
    );
    expect(manager.getState().state).toBe('ending_call');

    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-1',
    );
    expect(manager.getState().state).toBe('idle');
  });
});
