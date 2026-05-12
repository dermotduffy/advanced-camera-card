import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  MicrophoneManager,
  MicrophoneNotSupportedError,
} from '../../src/card-controller/microphone-manager';
import { MicrophoneState } from '../../src/card-controller/types';
import { createCardAPI, createConfig } from '../test-utils';

const navigatorMock: Navigator = {
  ...mock<Navigator>(),
  mediaDevices: {
    ...mock<MediaDevices>(),
    getUserMedia: vi.fn(),
  },
};

const medialessNavigatorMock: Navigator = {
  ...navigatorMock,

  // Some browser will set mediaDevices to undefined when access over http.
  mediaDevices: undefined as unknown as MediaDevices,
};

// @vitest-environment jsdom
describe('MicrophoneManager', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', navigatorMock);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  const createMockStream = (mute?: boolean): MediaStream => {
    const stream = mock<MediaStream>();
    const track = mock<MediaStreamTrack>();
    track.enabled = !mute;
    stream.getTracks.mockImplementation(() => [track]);
    return stream;
  };

  it('should be muted on creation', () => {
    const manager = new MicrophoneManager(createCardAPI());
    expect(manager).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should be undefined without creation', () => {
    const manager = new MicrophoneManager(createCardAPI());
    expect(manager.getStream()).toBeUndefined();
  });

  it('should connect', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    await manager.connect();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.getStream()).toBe(stream);
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should be unsupported without browser support', () => {
    vi.stubGlobal('navigator', medialessNavigatorMock);

    const manager = new MicrophoneManager(createCardAPI());

    expect(manager.isSupported()).toBeFalsy();
  });

  it('should not connect when not supported', async () => {
    vi.stubGlobal('navigator', medialessNavigatorMock);

    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    await expect(manager.connect()).rejects.toThrow(MicrophoneNotSupportedError);

    expect(manager.isConnected()).toBeFalsy();
  });

  it('should be forbidden when permission denied', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockRejectedValue(new Error());

    await expect(manager.connect()).rejects.toThrow(Error);

    expect(manager.isConnected()).toBeFalsy();
    expect(manager.isForbidden()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should mute and unmute', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    await manager.connect();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    manager.mute();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(2);

    await manager.unmute();
    expect(manager.isMuted()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalledTimes(3);
  });

  it('should not unmute when microphone forbidden', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockRejectedValue(new Error());

    await expect(manager.connect()).rejects.toThrow(Error);

    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    await manager.unmute();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);
  });

  it('should not unmute when not supported', async () => {
    vi.stubGlobal('navigator', medialessNavigatorMock);

    const manager = new MicrophoneManager(createCardAPI());

    await manager.unmute();

    expect(manager.isConnected()).toBeFalsy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should connect on unmute', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    expect(manager.isConnected()).toBeFalsy();

    await manager.unmute();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.isMuted()).toBeFalsy();

    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should disconnect', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    await manager.connect();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    manager.disconnect();
    expect(manager.isConnected()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalledTimes(2);
  });

  it('should automatically disconnect', async () => {
    vi.useFakeTimers();

    const disconnectSeconds = 10;
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        live: {
          microphone: {
            always_connected: false,
            disconnect_seconds: disconnectSeconds,
          },
        },
      }),
    );

    await manager.connect();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    vi.advanceTimersByTime(disconnectSeconds * 1000);

    expect(manager.isConnected()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalledTimes(2);
  });

  it('should not automatically disconnect when always connected', async () => {
    vi.useFakeTimers();

    const disconnectSeconds = 10;
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        live: {
          microphone: {
            always_connected: true,
            disconnect_seconds: disconnectSeconds,
          },
        },
      }),
    );

    await manager.connect();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);

    vi.advanceTimersByTime(disconnectSeconds * 1000);

    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toBeCalledTimes(1);
  });

  describe('isLocking', () => {
    it('should not lock when muted', () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          live: {
            microphone: {
              lock: true,
            },
          },
        }),
      );

      expect(manager.isMuted()).toBeTruthy();
      expect(manager.isLocking()).toBeFalsy();
    });

    it('should lock when unmuted and lock is enabled', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          live: {
            microphone: {
              lock: true,
            },
          },
        }),
      );
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
        createMockStream(),
      );

      await manager.unmute();

      expect(manager.isMuted()).toBeFalsy();
      expect(manager.isLocking()).toBeTruthy();
    });

    it('should not lock when unmuted but lock is disabled', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          live: {
            microphone: {
              lock: false,
            },
          },
        }),
      );
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
        createMockStream(),
      );

      await manager.unmute();

      expect(manager.isMuted()).toBeFalsy();
      expect(manager.isLocking()).toBeFalsy();
    });

    it('should not lock when config is unavailable', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
        createMockStream(),
      );

      await manager.unmute();

      expect(manager.isMuted()).toBeFalsy();
      expect(manager.isLocking()).toBeFalsy();
    });
  });

  describe('should require initialization', async () => {
    it('should require when configured and supported', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          live: {
            microphone: {
              always_connected: true,
            },
          },
        }),
      );

      await manager.connect();

      expect(manager.shouldConnectOnInitialization()).toBeTruthy();
    });

    it('should not require when configured but not supported', async () => {
      vi.stubGlobal('navigator', medialessNavigatorMock);

      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          live: {
            microphone: {
              always_connected: true,
            },
          },
        }),
      );

      await expect(manager.connect()).rejects.toThrow(MicrophoneNotSupportedError);

      expect(manager.shouldConnectOnInitialization()).toBeFalsy();
    });

    it('should not require when neither configured nor supported', async () => {
      vi.stubGlobal('navigator', medialessNavigatorMock);

      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      await expect(manager.connect()).rejects.toThrow(MicrophoneNotSupportedError);

      expect(manager.shouldConnectOnInitialization()).toBeFalsy();
    });
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    manager.initialize();
    expect(api.getConditionStateManager().setState).toBeCalledWith({
      microphone: { connected: false, muted: true, forbidden: false, stream: undefined },
    });
  });

  it('should set state', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    expect(api.getConditionStateManager().setState).not.toBeCalled();

    await manager.connect();

    let expectedState: MicrophoneState = {
      forbidden: false,
      stream: stream,
      connected: true,
      muted: true,
    };

    expect(manager.getState()).toEqual(expectedState);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        microphone: expectedState,
      }),
    );

    await manager.unmute();

    expectedState = {
      forbidden: false,
      stream: stream,
      connected: true,
      muted: false,
    };
    expect(manager.getState()).toEqual(expectedState);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        microphone: expectedState,
      }),
    );

    manager.mute();

    expectedState = {
      forbidden: false,
      stream: stream,
      connected: true,
      muted: true,
    };
    expect(manager.getState()).toEqual(expectedState);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        microphone: expectedState,
      }),
    );

    manager.disconnect();

    expectedState = {
      forbidden: false,
      stream: undefined,
      connected: false,
      muted: true,
    };
    expect(manager.getState()).toEqual(expectedState);
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        microphone: expectedState,
      }),
    );
  });
});
