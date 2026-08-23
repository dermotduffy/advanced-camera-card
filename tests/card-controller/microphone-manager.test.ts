import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  MicrophoneManager,
  MicrophoneNotSupportedError,
} from '../../src/card-controller/microphone-manager';
import type { MicrophoneState } from '../../src/card-controller/types';
import { createConfig } from '../config/test-utils';
import { createCardAPI } from '../test-utils';

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
    stream.getAudioTracks.mockImplementation(() => [track]);
    return stream;
  };

  // Streams from `createMockStream` carry exactly one track.
  const getTrack = (stream: MediaStream): MediaStreamTrack => stream.getTracks()[0];

  const createDeferredStream = (): {
    promise: Promise<MediaStream>;
    resolve: (stream: MediaStream) => void;
    reject: (error: Error) => void;
  } => {
    let resolveStream: ((stream: MediaStream) => void) | null = null;
    let rejectStream: ((error: Error) => void) | null = null;
    const promise = new Promise<MediaStream>((resolve, reject) => {
      resolveStream = resolve;
      rejectStream = reject;
    });
    return {
      promise,
      resolve: (stream: MediaStream) => resolveStream?.(stream),
      reject: (error: Error) => rejectStream?.(error),
    };
  };

  it('should be muted on creation', () => {
    const manager = new MicrophoneManager(createCardAPI());
    expect(manager).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should have no stream before connecting', () => {
    const manager = new MicrophoneManager(createCardAPI());
    expect(manager.getStream()).toBeNull();
  });

  it('should connect while transmission is active', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    manager.setTransmissionActive(true);
    expect(await manager.connect()).toBe(true);

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.getStream()).toBe(stream);
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toHaveBeenCalled();
    expect(navigatorMock.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: false,
    });
  });

  it('should request configured ideal audio constraints', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        live: {
          microphone: {
            constraints: {
              echo_cancellation: true,
              noise_suppression: false,
              auto_gain_control: false,
              channel_count: 1,
            },
          },
        },
      }),
    );
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );
    const manager = new MicrophoneManager(api);

    manager.setTransmissionActive(true);
    await manager.connect();

    expect(navigatorMock.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: false },
        autoGainControl: { ideal: false },
        channelCount: { ideal: 1 },
      },
      video: false,
    });
  });

  it('should request only configured audio constraints', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        live: {
          microphone: {
            constraints: {
              noise_suppression: true,
            },
          },
        },
      }),
    );
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );
    const manager = new MicrophoneManager(api);

    manager.setTransmissionActive(true);
    await manager.connect();

    expect(navigatorMock.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        noiseSuppression: { ideal: true },
      },
      video: false,
    });
  });

  it('should expose microphone diagnostics without device identifiers', async () => {
    const api = createCardAPI();
    const stream = createMockStream();
    const track = getTrack(stream);
    vi.mocked(track.getCapabilities).mockReturnValue({
      echoCancellation: [true, false],
      deviceId: 'secret-device',
    });
    vi.mocked(track.getConstraints).mockReturnValue({
      echoCancellation: { ideal: true },
      deviceId: { exact: 'secret-device' },
    });
    vi.mocked(track.getSettings).mockReturnValue({
      echoCancellation: true,
      deviceId: 'secret-device',
      groupId: 'secret-group',
    });
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);
    const manager = new MicrophoneManager(api);

    manager.setTransmissionActive(true);
    await manager.connect();
    manager.setTransmissionActive(false);

    expect(manager.getDiagnostics()).toEqual({
      capabilities: {
        echoCancellation: [true, false],
      },
      constraints: {
        echoCancellation: { ideal: true },
      },
      settings: {
        echoCancellation: true,
      },
    });
  });

  it('should support tracks without diagnostic methods', async () => {
    const api = createCardAPI();
    const stream = createMockStream();
    const track = getTrack(stream);
    track.getCapabilities = undefined as unknown as MediaStreamTrack['getCapabilities'];
    track.getConstraints = undefined as unknown as MediaStreamTrack['getConstraints'];
    track.getSettings = undefined as unknown as MediaStreamTrack['getSettings'];
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);
    const manager = new MicrophoneManager(api);

    manager.setTransmissionActive(true);
    expect(await manager.connect()).toBeTruthy();
    expect(manager.getDiagnostics()).toEqual({
      capabilities: undefined,
      constraints: undefined,
      settings: undefined,
    });
  });

  it('should release a stream that connects without active transmission', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);

    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    expect(await manager.connect()).toBe(false);

    expect(manager.isConnected()).toBeFalsy();
    expect(manager.isForbidden()).toBeFalsy();
    expect(getTrack(stream).stop).toHaveBeenCalled();
    expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        microphone: expect.objectContaining({ connected: false, muted: true }),
      }),
    );
  });

  it('should hold a muted stream without transmission when always connected', async () => {
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

    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    await manager.connect();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
    expect(getTrack(stream).stop).not.toHaveBeenCalled();

    manager.mute();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
    expect(getTrack(stream).stop).not.toHaveBeenCalled();
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
    expect(api.getCardElementManager().update).toHaveBeenCalled();
  });

  it('should mute and unmute while transmission is active', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    manager.setTransmissionActive(true);
    expect(api.getCardElementManager().update).toHaveBeenCalledTimes(1);

    await manager.connect();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).toHaveBeenCalledTimes(2);

    await manager.unmute();
    expect(manager.isMuted()).toBeFalsy();
    expect(api.getCardElementManager().update).toHaveBeenCalledTimes(3);

    manager.mute();
    expect(manager.isMuted()).toBeTruthy();
    expect(manager.isConnected()).toBeTruthy();
    expect(api.getCardElementManager().update).toHaveBeenCalledTimes(4);

    // Unmuting again reuses the held stream rather than re-requesting the
    // device.
    await manager.unmute();
    expect(manager.isMuted()).toBeFalsy();
    expect(navigatorMock.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('should not unmute without active transmission', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    await manager.unmute();

    expect(navigatorMock.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(manager.isConnected()).toBeFalsy();
    expect(manager.isMuted()).toBeTruthy();
    expect(api.getCardElementManager().update).not.toHaveBeenCalled();
  });

  it('should not unmute without active transmission when always connected', async () => {
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

    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    await manager.connect();
    expect(manager.isMuted()).toBeTruthy();

    await manager.unmute();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should not unmute when microphone forbidden', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockRejectedValue(new Error());

    manager.setTransmissionActive(true);
    await expect(manager.connect()).rejects.toThrow(Error);

    expect(manager.isMuted()).toBeTruthy();

    await manager.unmute();

    expect(manager.isForbidden()).toBeTruthy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should not unmute when not supported', async () => {
    vi.stubGlobal('navigator', medialessNavigatorMock);

    const manager = new MicrophoneManager(createCardAPI());

    await manager.unmute();

    expect(manager.isConnected()).toBeFalsy();
    expect(manager.isMuted()).toBeTruthy();
  });

  it('should connect on unmute while transmission is active', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(
      createMockStream(),
    );

    manager.setTransmissionActive(true);
    expect(manager.isConnected()).toBeFalsy();

    await manager.unmute();

    expect(manager.isConnected()).toBeTruthy();
    expect(manager.isMuted()).toBeFalsy();

    expect(api.getCardElementManager().update).toHaveBeenCalled();
  });

  describe('should follow transmission state', () => {
    it('should release the stream and reset mute when transmission ends', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const stream = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

      manager.setTransmissionActive(true);
      await manager.connect();
      await manager.unmute();
      expect(manager.isMuted()).toBeFalsy();

      manager.setTransmissionActive(false);

      expect(manager.isConnected()).toBeFalsy();
      expect(getTrack(stream).stop).toHaveBeenCalled();
      expect(api.getConditionStateManager().setState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          microphone: expect.objectContaining({ connected: false, muted: true }),
        }),
      );

      // The next transmission must not start with a hot microphone: the desired mute
      // was reset when the previous transmission ended.
      const newStream = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(newStream);
      manager.setTransmissionActive(true);
      await manager.connect();
      expect(manager.isConnected()).toBeTruthy();
      expect(manager.isMuted()).toBeTruthy();
    });

    it('should keep the stream muted when transmission ends and always connected', async () => {
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
      const stream = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

      manager.setTransmissionActive(true);
      await manager.connect();
      await manager.unmute();
      expect(manager.isMuted()).toBeFalsy();

      manager.setTransmissionActive(false);

      expect(manager.isConnected()).toBeTruthy();
      expect(manager.isMuted()).toBeTruthy();
      expect(getTrack(stream).stop).not.toHaveBeenCalled();
    });

    it('should ignore the end of a transmission that never started', async () => {
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
      const stream = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

      await manager.connect();
      expect(manager.isConnected()).toBeTruthy();
      expect(api.getCardElementManager().update).toHaveBeenCalledTimes(1);

      manager.setTransmissionActive(false);

      expect(manager.isConnected()).toBeTruthy();
      expect(getTrack(stream).stop).not.toHaveBeenCalled();
      expect(api.getCardElementManager().update).toHaveBeenCalledTimes(1);
    });

    it('should ignore a transmission report that changes nothing', () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);

      manager.setTransmissionActive(true);
      manager.setTransmissionActive(true);

      expect(api.getCardElementManager().update).toHaveBeenCalledTimes(1);
    });
  });

  describe('should guard in-flight connections', () => {
    it('should release a stream whose connect completes after a mute', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const stream = createMockStream();
      const deferred = createDeferredStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockReturnValue(
        deferred.promise,
      );

      const connectPromise = manager.connect();
      manager.mute();
      deferred.resolve(stream);
      await connectPromise;

      expect(manager.isConnected()).toBeFalsy();
      expect(getTrack(stream).stop).toHaveBeenCalled();
    });

    it('should release a stream whose connect completes after transmission ends', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const stream = createMockStream();
      const deferred = createDeferredStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockReturnValue(
        deferred.promise,
      );

      manager.setTransmissionActive(true);
      const connectPromise = manager.connect();
      manager.setTransmissionActive(false);
      deferred.resolve(stream);
      await connectPromise;

      expect(manager.isConnected()).toBeFalsy();
      expect(getTrack(stream).stop).toHaveBeenCalled();
    });

    it('should not install a stream whose connect completes after the held stream is released', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const held = createMockStream();
      const late = createMockStream();
      const deferred = createDeferredStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(held)
        .mockReturnValueOnce(deferred.promise);

      manager.setTransmissionActive(true);
      await manager.connect();
      const connectPromise = manager.connect();

      // Releasing the held stream also invalidates the connect still in
      // flight.
      manager.setTransmissionActive(false);
      deferred.resolve(late);
      await connectPromise;

      expect(manager.isConnected()).toBeFalsy();
      expect(getTrack(held).stop).toHaveBeenCalled();
      expect(getTrack(late).stop).toHaveBeenCalled();
    });

    it('should keep only the newest of overlapping connects', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const streamA = createMockStream();
      const streamB = createMockStream();
      const deferredA = createDeferredStream();
      const deferredB = createDeferredStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia)
        .mockReturnValueOnce(deferredA.promise)
        .mockReturnValueOnce(deferredB.promise);

      manager.setTransmissionActive(true);
      const connectA = manager.connect();
      const connectB = manager.connect();

      deferredA.resolve(streamA);
      deferredB.resolve(streamB);
      expect(await connectA).toBe(false);
      expect(await connectB).toBe(true);

      expect(manager.isConnected()).toBeTruthy();
      expect(manager.getStream()).toBe(streamB);
      expect(getTrack(streamA).stop).toHaveBeenCalled();
      expect(getTrack(streamB).stop).not.toHaveBeenCalled();
    });

    it('should not mark forbidden on a stale connect rejection', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const streamB = createMockStream();
      const deferredA = createDeferredStream();
      const deferredB = createDeferredStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia)
        .mockReturnValueOnce(deferredA.promise)
        .mockReturnValueOnce(deferredB.promise);

      manager.setTransmissionActive(true);
      const connectA = manager.connect();
      const connectB = manager.connect();

      deferredA.reject(new Error());
      deferredB.resolve(streamB);
      await expect(connectA).rejects.toThrow(Error);
      await connectB;

      expect(manager.isForbidden()).toBeFalsy();
      expect(manager.isConnected()).toBeTruthy();
      expect(manager.getStream()).toBe(streamB);
    });

    it('should stop the replaced stream when connecting over an existing stream', async () => {
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      const streamA = createMockStream();
      const streamB = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia)
        .mockResolvedValueOnce(streamA)
        .mockResolvedValueOnce(streamB);

      manager.setTransmissionActive(true);
      await manager.connect();
      expect(manager.getStream()).toBe(streamA);

      await manager.connect();

      expect(manager.getStream()).toBe(streamB);
      expect(getTrack(streamA).stop).toHaveBeenCalled();
      expect(getTrack(streamB).stop).not.toHaveBeenCalled();
    });
  });

  describe('should handle the device disappearing', () => {
    const endTrack = (stream: MediaStream): void => {
      const track = getTrack(stream);
      vi.mocked(track.addEventListener)
        .mock.calls.filter(([type]) => type === 'ended')
        .forEach(([, listener]) => (listener as EventListener)(new Event('ended')));
    };

    it('should release a stream whose track ends', async () => {
      const stream = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      manager.setTransmissionActive(true);
      await manager.connect();
      expect(manager.isConnected()).toBeTruthy();

      endTrack(stream);

      expect(manager.isConnected()).toBeFalsy();
      expect(manager.getStream()).toBeNull();
    });

    it('should stop listening to a stream that has been replaced', async () => {
      const streamA = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(streamA);
      const api = createCardAPI();
      const manager = new MicrophoneManager(api);
      manager.setTransmissionActive(true);
      await manager.connect();

      const streamB = createMockStream();
      vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(streamB);
      await manager.connect();

      const track = getTrack(streamA);
      const added = vi
        .mocked(track.addEventListener)
        .mock.calls.find(([type]) => type === 'ended');
      const removed = vi
        .mocked(track.removeEventListener)
        .mock.calls.find(([type]) => type === 'ended');

      expect(added).toBeDefined();
      expect(removed?.[1]).toBe(added?.[1]);
      expect(manager.getStream()).toBe(streamB);
    });
  });

  describe('should require initialization', async () => {
    it('should require when configured and supported', async () => {
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
    expect(api.getConditionStateManager().setState).toHaveBeenCalledWith({
      microphone: { connected: false, muted: true, forbidden: false, stream: null },
    });
  });

  it('should set state', async () => {
    const api = createCardAPI();
    const manager = new MicrophoneManager(api);
    const stream = createMockStream();
    vi.mocked(navigatorMock.mediaDevices.getUserMedia).mockResolvedValue(stream);

    expect(api.getConditionStateManager().setState).not.toHaveBeenCalled();

    manager.setTransmissionActive(true);
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

    manager.setTransmissionActive(false);

    expectedState = {
      forbidden: false,
      stream: null,
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
