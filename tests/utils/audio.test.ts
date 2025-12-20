import { describe, expect, it, vi } from 'vitest';
import {
  addAudioTracksMuteStateListener,
  AudioProperties,
  has2WayAudio,
  hasAudio,
  mayHaveAudio,
} from '../../src/utils/audio';

// @vitest-environment jsdom
describe('mayHaveAudio', () => {
  it('should detect audio when mozHasAudio true', () => {
    const element: HTMLVideoElement & AudioProperties = document.createElement('video');
    element.mozHasAudio = true;
    expect(mayHaveAudio(element)).toBeTruthy();
  });

  it('should not detect audio when mozHasAudio false', () => {
    const element: HTMLVideoElement & AudioProperties = document.createElement('video');
    element.mozHasAudio = false;
    expect(mayHaveAudio(element)).toBeFalsy();
  });

  it('should detect audio when audioTracks has length', () => {
    // Workaround: "Cannot set property audioTracks of #<HTMLMediaElement> which has only a getter"
    const element = {} as HTMLVideoElement & AudioProperties;
    element.audioTracks = [1, 2, 3];
    expect(mayHaveAudio(element)).toBeTruthy();
  });

  it('should not detect audio when audioTracks has no length', () => {
    // Workaround: "Cannot set property audioTracks of #<HTMLMediaElement> which has only a getter"
    const element = {} as HTMLVideoElement & AudioProperties;
    element.audioTracks = [];
    expect(mayHaveAudio(element)).toBeFalsy();
  });

  it('should detect audio when srcObject MediaStream has audio tracks', () => {
    // Mock MediaStream for jsdom environment
    const MockMediaStream = class MediaStream {};
    vi.stubGlobal('MediaStream', MockMediaStream);

    const element = {} as HTMLVideoElement & AudioProperties;
    const mockStream = new MockMediaStream();
    (mockStream as unknown as { getAudioTracks: () => unknown[] }).getAudioTracks =
      () => [{}];
    element.srcObject = mockStream as unknown as MediaStream;
    expect(mayHaveAudio(element)).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('should not detect audio when srcObject MediaStream has no audio tracks', () => {
    // Mock MediaStream for jsdom environment
    const MockMediaStream = class MediaStream {};
    vi.stubGlobal('MediaStream', MockMediaStream);

    const element = {} as HTMLVideoElement & AudioProperties;
    const mockStream = new MockMediaStream();
    (mockStream as unknown as { getAudioTracks: () => unknown[] }).getAudioTracks =
      () => [];
    element.srcObject = mockStream as unknown as MediaStream;
    expect(mayHaveAudio(element)).toBeFalsy();

    vi.unstubAllGlobals();
  });

  it('should detect audio when no evidence to the contrary', () => {
    const element = {} as HTMLVideoElement & AudioProperties;
    expect(mayHaveAudio(element)).toBeTruthy();
  });
});

describe('hasAudio', () => {
  const createMockVideo = (): HTMLVideoElement & AudioProperties => {
    return {} as HTMLVideoElement & AudioProperties;
  };

  const createMockReceiver = (trackKind: string, muted = false): RTCRtpReceiver => {
    return {
      track: { kind: trackKind, muted },
    } as unknown as RTCRtpReceiver;
  };

  const createMockPeerConnection = (receivers: RTCRtpReceiver[]): RTCPeerConnection => {
    return {
      getReceivers: () => receivers,
    } as unknown as RTCPeerConnection;
  };

  describe('WebRTC receiver detection', () => {
    it('should detect audio when there is an unmuted audio receiver', () => {
      const pc = createMockPeerConnection([
        createMockReceiver('video'),
        createMockReceiver('audio', false),
      ]);
      expect(hasAudio(createMockVideo(), pc, '')).toBe(true);
    });

    it('should not detect audio when audio receiver is muted', () => {
      const pc = createMockPeerConnection([
        createMockReceiver('video'),
        createMockReceiver('audio', true),
      ]);
      expect(hasAudio(createMockVideo(), pc, '')).toBe(false);
    });

    it('should not detect audio when only video receivers exist', () => {
      const pc = createMockPeerConnection([createMockReceiver('video')]);
      expect(hasAudio(createMockVideo(), pc, '')).toBe(false);
    });

    it('should fall back to mayHaveAudio when no receivers yet', () => {
      const pc = createMockPeerConnection([]);
      // Empty receivers means connection not established, falls back to mayHaveAudio
      // With no properties set on video, mayHaveAudio returns true (generous default)
      expect(hasAudio(createMockVideo(), pc, '')).toBe(true);
    });
  });

  describe('MSE codec detection', () => {
    it('should detect audio when mseCodecs contains mp4a', () => {
      expect(hasAudio(createMockVideo(), null, 'avc1.640029,mp4a.40.2')).toBe(true);
    });

    it('should detect audio when mseCodecs contains opus', () => {
      expect(hasAudio(createMockVideo(), null, 'avc1.640029,opus')).toBe(true);
    });

    it('should detect audio when mseCodecs contains flac', () => {
      expect(hasAudio(createMockVideo(), null, 'avc1.640029,flac')).toBe(true);
    });

    it('should not detect audio when mseCodecs contains only video codecs', () => {
      expect(hasAudio(createMockVideo(), null, 'avc1.640029,hvc1.1.6.L153.B0')).toBe(
        false,
      );
    });
  });

  describe('fallback to mayHaveAudio', () => {
    it('should fall back to mayHaveAudio when no SDP or mseCodecs', () => {
      // With no properties set, mayHaveAudio returns true (generous default)
      expect(hasAudio(createMockVideo(), null, '')).toBe(true);
    });

    it('should use mayHaveAudio when mozHasAudio is false', () => {
      const video = createMockVideo();
      video.mozHasAudio = false;
      expect(hasAudio(video, null, '')).toBe(false);
    });
  });
});

describe('has2WayAudio', () => {
  const createMockTransceiver = (
    trackKind: string | null,
    direction: RTCRtpTransceiverDirection,
  ): RTCRtpTransceiver => {
    return {
      sender: {
        track: trackKind ? { kind: trackKind } : null,
      },
      direction,
    } as unknown as RTCRtpTransceiver;
  };

  const createMockPeerConnection = (
    transceivers: RTCRtpTransceiver[],
  ): RTCPeerConnection => {
    return {
      getTransceivers: () => transceivers,
    } as unknown as RTCPeerConnection;
  };

  it('should return false for null peer connection', () => {
    expect(has2WayAudio(null)).toBe(false);
  });

  it('should return false when no transceivers', () => {
    const pc = createMockPeerConnection([]);
    expect(has2WayAudio(pc)).toBe(false);
  });

  it('should return true when audio transceiver is sendonly', () => {
    const pc = createMockPeerConnection([createMockTransceiver('audio', 'sendonly')]);
    expect(has2WayAudio(pc)).toBe(true);
  });

  it('should return true when audio transceiver is sendrecv', () => {
    const pc = createMockPeerConnection([createMockTransceiver('audio', 'sendrecv')]);
    expect(has2WayAudio(pc)).toBe(true);
  });

  it('should return false when audio transceiver is recvonly', () => {
    const pc = createMockPeerConnection([createMockTransceiver('audio', 'recvonly')]);
    expect(has2WayAudio(pc)).toBe(false);
  });

  it('should return false when audio transceiver is inactive', () => {
    const pc = createMockPeerConnection([createMockTransceiver('audio', 'inactive')]);
    expect(has2WayAudio(pc)).toBe(false);
  });

  it('should return false when only video transceiver with sendonly', () => {
    const pc = createMockPeerConnection([createMockTransceiver('video', 'sendonly')]);
    expect(has2WayAudio(pc)).toBe(false);
  });

  it('should return false when transceiver has no track', () => {
    const pc = createMockPeerConnection([createMockTransceiver(null, 'sendonly')]);
    expect(has2WayAudio(pc)).toBe(false);
  });

  it('should return true when mixed transceivers include sendonly audio', () => {
    const pc = createMockPeerConnection([
      createMockTransceiver('video', 'recvonly'),
      createMockTransceiver('audio', 'recvonly'),
      createMockTransceiver('audio', 'sendonly'),
    ]);
    expect(has2WayAudio(pc)).toBe(true);
  });
});

describe('addAudioTracksMuteStateListener', () => {
  interface MockTrack {
    kind: string;
    muted: boolean;
    listeners: Map<string, Set<() => void>>;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
    triggerEvent: (event: string) => void;
  }

  const createMockTrack = (kind: string, muted: boolean): MockTrack => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      kind,
      muted,
      listeners,
      addEventListener: (event, handler) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)?.add(handler);
      },
      removeEventListener: (event, handler) => {
        listeners.get(event)?.delete(handler);
      },
      triggerEvent: (event) => {
        listeners.get(event)?.forEach((h) => h());
      },
    };
  };

  const createMockPeerConnection = (tracks: MockTrack[]): RTCPeerConnection => {
    return {
      getReceivers: () => tracks.map((t) => ({ track: t })),
    } as unknown as RTCPeerConnection;
  };

  it('should return null for null peer connection', () => {
    const callback = vi.fn();
    expect(addAudioTracksMuteStateListener(null, callback)).toBe(null);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should return null when no audio tracks', () => {
    const callback = vi.fn();
    const pc = createMockPeerConnection([createMockTrack('video', false)]);
    expect(addAudioTracksMuteStateListener(pc, callback)).toBe(null);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should call callback with true when any track unmutes', () => {
    const callback = vi.fn();
    const track1 = createMockTrack('audio', true);
    const track2 = createMockTrack('audio', true);
    const pc = createMockPeerConnection([track1, track2]);

    addAudioTracksMuteStateListener(pc, callback);

    // Unmute first track - now has audio
    track1.muted = false;
    track1.triggerEvent('unmute');
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('should call callback with false when all tracks become muted', () => {
    const callback = vi.fn();
    const track1 = createMockTrack('audio', false);
    const track2 = createMockTrack('audio', false);
    const pc = createMockPeerConnection([track1, track2]);

    addAudioTracksMuteStateListener(pc, callback);

    // Mute first track - still have an unmuted track, no callback yet
    track1.muted = true;
    track1.triggerEvent('mute');
    expect(callback).not.toHaveBeenCalled();

    // Mute second track - all muted now
    track2.muted = true;
    track2.triggerEvent('mute');
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('should not call callback if state has not changed', () => {
    const callback = vi.fn();
    const track = createMockTrack('audio', true);
    const pc = createMockPeerConnection([track]);

    addAudioTracksMuteStateListener(pc, callback);

    // Trigger unmute but don't actually change muted state
    track.triggerEvent('unmute');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should remove listeners on cleanup', () => {
    const callback = vi.fn();
    const track = createMockTrack('audio', true);
    const pc = createMockPeerConnection([track]);

    const cleanup = addAudioTracksMuteStateListener(pc, callback);
    cleanup?.();

    // Change state and trigger - should not call callback
    track.muted = false;
    track.triggerEvent('unmute');
    expect(callback).not.toHaveBeenCalled();
  });
});
