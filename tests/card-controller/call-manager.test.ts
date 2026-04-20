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
  it('should expose lock and end-on-view-change state from the active call', async () => {
    const api = createCardAPI();
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
              lock_navigation: true,
              end_call_on_view_change: true,
            },
          }),
        },
      ]),
    );

    const manager = new CallManager(api);

    expect(manager.isNavigationLocked()).toBe(false);
    expect(manager.shouldEndOnViewChange()).toBe(false);

    await manager.startCall();

    expect(manager.isNavigationLocked()).toBe(true);
    expect(manager.shouldEndOnViewChange()).toBe(true);
  });

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

  it('should reject call mode when no active view is selected', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        message: 'Call mode can only be started from the live view',
      }),
    );
  });

  it('should return null for the active camera config when there is no current view', () => {
    class TestCallManager extends CallManager {
      public getActiveCameraConfigForTest() {
        return this._getActiveCameraConfig();
      }
    }

    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(null);

    const manager = new TestCallManager(api);

    expect(manager.getActiveCameraConfigForTest()).toBeNull();
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

  it('should reject calls when a session is already active', async () => {
    const api = createCardAPI();
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

    const manager = new CallManager(api);

    await expect(manager.startCall()).resolves.toBe(true);
    await expect(manager.startCall()).resolves.toBe(false);
  });

  it('should reject call mode without an active camera config', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(createStore([]));

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        message: 'Call mode can only be started from the live view',
      }),
    );
  });

  it('should reject when call mode is disabled', async () => {
    const api = createCardAPI();
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
              enabled: false,
            },
          }),
        },
      ]),
    );

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        message: 'Call mode is not enabled for the selected camera',
      }),
    );
  });

  it('should reject when a call stream is not configured', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera-1',
          config: {
            live_provider: 'go2rtc',
            call_mode: {
              enabled: true,
            },
          } as never,
        },
      ]),
    );

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        message: 'A dedicated call stream must be configured before starting a call',
      }),
    );
  });

  it('should reject when a substream override is active', async () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        camera: 'camera-1',
        view: 'live',
        context: {
          live: {
            overrides: new Map([['camera-1', 'camera-2']]),
          },
        },
      }),
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

    const manager = new CallManager(api);
    await expect(manager.startCall()).resolves.toBe(false);

    expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
      expect.objectContaining({
        message: 'Call mode cannot be started while a substream override is active',
      }),
    );
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

  it('should keep speaker and microphone muted when auto-enable is disabled', async () => {
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
              auto_enable_microphone: false,
              auto_enable_speaker: false,
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

    mediaPlayerController.mute.mockClear();
    vi.mocked(api.getMicrophoneManager().mute).mockClear();

    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-1',
    );

    expect(mediaPlayerController.mute).toBeCalled();
    expect(mediaPlayerController.unmute).not.toBeCalled();
    expect(api.getMicrophoneManager().mute).toBeCalled();
    expect(api.getMicrophoneManager().unmute).not.toBeCalled();
    expect(manager.getState().state).toBe('in_call');
  });

  it('should ignore additional media loaded events once the call is active', async () => {
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
      'camera-1',
    );

    mediaPlayerController.unmute.mockClear();
    vi.mocked(api.getMicrophoneManager().unmute).mockClear();

    await manager.onMediaLoaded(
      createMediaLoadedInfo({ mediaPlayerController }),
      'camera-1',
    );

    expect(manager.getState().state).toBe('in_call');
    expect(mediaPlayerController.unmute).not.toBeCalled();
    expect(api.getMicrophoneManager().unmute).not.toBeCalled();
  });

  it('should return false when ending an inactive call', async () => {
    const manager = new CallManager(createCardAPI());

    await expect(manager.endCall()).resolves.toBe(false);
  });

  it('should end immediately without view changes when requested', async () => {
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

    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    await expect(manager.endCall({ modifyViewContext: false })).resolves.toBe(true);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(manager.getState().state).toBe('idle');
  });

  it('should fall back to the generic media info when the camera-specific entry is missing', async () => {
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
    vi.mocked(api.getMediaLoadedInfoManager().get).mockImplementation((cameraID) => {
      if (cameraID) {
        return null;
      }
      return createMediaLoadedInfo({ mediaPlayerController });
    });

    const manager = new CallManager(api);
    await manager.startCall();

    mediaPlayerController.mute.mockClear();
    await manager.endCall({ modifyViewContext: false });

    expect(mediaPlayerController.mute).toBeCalled();
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

  it('should ignore live errors when the call is inactive or for another camera', async () => {
    const api = createCardAPI();
    const manager = new CallManager(api);

    await manager.onLiveError('camera-1');
    expect(api.getMessageManager().setMessageIfHigherPriority).not.toBeCalled();

    const activeAPI = createCardAPI();
    vi.mocked(activeAPI.getViewManager().getView).mockReturnValue(
      createView({ camera: 'camera-1', view: 'live' }),
    );
    vi.mocked(activeAPI.getCameraManager().getStore).mockReturnValue(
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

    const activeManager = new CallManager(activeAPI);
    await activeManager.startCall();

    vi.mocked(activeAPI.getMessageManager().setMessageIfHigherPriority).mockClear();
    await activeManager.onLiveError('camera-2');

    expect(activeAPI.getMessageManager().setMessageIfHigherPriority).not.toBeCalled();
    expect(activeManager.getState().state).toBe('connecting_call');
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

  it('should reset immediately on live errors while ending the call', async () => {
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
    await manager.endCall();

    vi.mocked(api.getMessageManager().setMessageIfHigherPriority).mockClear();
    await manager.onLiveError('camera-1');

    expect(manager.getState().state).toBe('idle');
    expect(api.getMessageManager().setMessageIfHigherPriority).not.toBeCalled();
  });

  it('should suppress the regular menu during a call by default', async () => {
    const api = createCardAPI();
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

    const manager = new CallManager(api);

    expect(manager.shouldHideMenuDuringCall()).toBe(false);

    await manager.startCall();

    expect(manager.shouldHideMenuDuringCall()).toBe(true);
  });

  it('should allow the regular menu during a call when configured', async () => {
    const api = createCardAPI();
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
              hide_menu_during_call: false,
            },
          }),
        },
      ]),
    );

    const manager = new CallManager(api);
    await manager.startCall();

    expect(manager.shouldHideMenuDuringCall()).toBe(false);
  });
});
