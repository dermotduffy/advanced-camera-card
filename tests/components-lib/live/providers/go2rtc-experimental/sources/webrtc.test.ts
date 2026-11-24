import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebRTCStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/webrtc';
import type {
  StreamSourceContext,
  VideoStreamTarget,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import {
  FakeMediaStream,
  FakeRTCPeerConnection,
  type FakeMediaStreamTrack,
} from '../../../../../go2rtc/test-utils';
import { flushPromises } from '../../../../../test-utils';
import { createPromiseWithResolvers } from '../../../../../utils/test-utils';
import { FakeStreamSourceChannel } from '../test-utils';

const ICE_SERVERS = [
  { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'c' },
];

// `start()` creates the peer connection once the ICE servers have resolved.
const startAndFlush = async (source: WebRTCStreamSource): Promise<void> => {
  source.start();
  await flushPromises();
};

// @vitest-environment jsdom
describe('WebRTCStreamSource', () => {
  const setup = (options?: { getICEServers?: () => Promise<RTCIceServer[]> }) => {
    const video = document.createElement('video');
    const channel = new FakeStreamSourceChannel();
    const loadedCallback = vi.fn();
    const failedCallback = vi.fn();

    const context: StreamSourceContext<VideoStreamTarget> = {
      target: { kind: 'video', video },
      channel,
      callbacks: { loadedCallback, failedCallback },
    };

    const pc = new FakeRTCPeerConnection();
    const createPeerConnection = vi.fn(() => pc.asPeerConnection());
    const source = new WebRTCStreamSource(
      context,
      options?.getICEServers ?? (async () => ICE_SERVERS),
      {
        createPeerConnection,
        createMediaStream: (tracks) =>
          new FakeMediaStream(
            tracks as unknown as FakeMediaStreamTrack[],
          ).asMediaStream(),
      },
    );

    return {
      channel,
      context,
      createPeerConnection,
      failedCallback,
      loadedCallback,
      pc,
      source,
      video,
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ICE servers', () => {
    it('should request the ICE servers once on start', async () => {
      const getICEServers = vi.fn(async () => ICE_SERVERS);
      const { source } = setup({ getICEServers });

      expect(getICEServers).not.toHaveBeenCalled();

      await startAndFlush(source);

      expect(getICEServers).toHaveBeenCalledTimes(1);
    });

    it('should create the peer connection with the provided ICE servers', async () => {
      const { source, createPeerConnection } = setup();
      await startAndFlush(source);

      expect(createPeerConnection).toHaveBeenCalledWith({
        bundlePolicy: 'max-bundle',
        iceServers: ICE_SERVERS,
      });
    });

    it('should not create the peer connection until the ICE servers arrive', async () => {
      const iceServers = createPromiseWithResolvers<RTCIceServer[]>();
      const { source, createPeerConnection } = setup({
        getICEServers: () => iceServers.promise,
      });
      await startAndFlush(source);

      expect(createPeerConnection).not.toHaveBeenCalled();

      iceServers.resolve(ICE_SERVERS);
      await flushPromises();

      expect(createPeerConnection).toHaveBeenCalledTimes(1);
    });

    it('should not create a peer connection when stopped while waiting', async () => {
      const iceServers = createPromiseWithResolvers<RTCIceServer[]>();
      const { source, createPeerConnection, failedCallback } = setup({
        getICEServers: () => iceServers.promise,
      });
      await startAndFlush(source);
      source.stop();
      iceServers.resolve(ICE_SERVERS);
      await flushPromises();
      vi.advanceTimersByTime(5 * 1000);

      expect(createPeerConnection).not.toHaveBeenCalled();
      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should not count the wait for ICE servers against the connect timeout', async () => {
      const iceServers = createPromiseWithResolvers<RTCIceServer[]>();
      const { source, failedCallback } = setup({
        getICEServers: () => iceServers.promise,
      });
      await startAndFlush(source);
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toHaveBeenCalled();

      iceServers.resolve(ICE_SERVERS);
      await flushPromises();
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).toHaveBeenCalledWith('connect_timeout');
    });

    it('should fail when the ICE servers cannot be obtained', async () => {
      const { source, failedCallback } = setup({
        getICEServers: () => Promise.reject(new Error('no ICE servers')),
      });
      await startAndFlush(source);

      expect(failedCallback).toHaveBeenCalledWith('media_error');
    });

    it('should ignore a failure to obtain ICE servers after stop', async () => {
      const iceServers = createPromiseWithResolvers<RTCIceServer[]>();
      const { source, failedCallback } = setup({
        getICEServers: () => iceServers.promise,
      });
      await startAndFlush(source);
      source.stop();
      iceServers.reject(new Error('no ICE servers'));
      await flushPromises();

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });

  describe('transceivers', () => {
    it('should offer inbound video and audio only', async () => {
      const { source, pc } = setup();
      await startAndFlush(source);

      expect(pc.transceivers.map((transceiver) => transceiver.direction)).toEqual([
        'recvonly',
        'recvonly',
      ]);
    });
  });

  describe('negotiation', () => {
    it('should send an offer after setting the local description', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      await flushPromises();

      expect(pc.setLocalDescription).toHaveBeenCalled();
      expect(channel.sent).toContainEqual({
        type: 'webrtc/offer',
        value: 'v=0\r\noffer',
      });
    });

    it('should send an empty offer sdp when the browser omits it', async () => {
      const { source, channel, pc } = setup();
      pc.createOffer.mockResolvedValue({ type: 'offer', sdp: undefined });
      await startAndFlush(source);
      await flushPromises();

      expect(channel.sent).toContainEqual({ type: 'webrtc/offer', value: '' });
    });

    it('should not send an offer if the connection was replaced mid-negotiation', async () => {
      const { source, channel, pc } = setup();
      let resolveOffer: (value: { type: string; sdp: string }) => void = () => {};
      pc.createOffer.mockReturnValue(
        new Promise((resolve) => {
          resolveOffer = resolve;
        }),
      );
      await startAndFlush(source);
      source.stop();
      resolveOffer({ type: 'offer', sdp: 'v=0\r\noffer' });
      await flushPromises();

      expect(channel.sent).not.toContainEqual(
        expect.objectContaining({ type: 'webrtc/offer' }),
      );
    });

    it('should not send an offer if replaced between offer and local description', async () => {
      const { source, channel, pc } = setup();
      let resolveLocal: () => void = () => {};
      pc.setLocalDescription.mockReturnValue(
        new Promise((resolve) => {
          resolveLocal = resolve;
        }),
      );
      await startAndFlush(source);
      await flushPromises();
      source.stop();
      resolveLocal();
      await flushPromises();

      expect(channel.sent).not.toContainEqual(
        expect.objectContaining({ type: 'webrtc/offer' }),
      );
    });

    it('should fail on a negotiation error for the current connection', async () => {
      const { source, pc, failedCallback } = setup();
      pc.createOffer.mockRejectedValue(new Error('offer failed'));
      await startAndFlush(source);
      await flushPromises();

      expect(failedCallback).toHaveBeenCalledWith('media_error');
    });

    it('should ignore a negotiation error after the connection was replaced', async () => {
      const { source, pc, failedCallback } = setup();
      let rejectOffer: (reason: Error) => void = () => {};
      pc.createOffer.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectOffer = reject;
        }),
      );
      await startAndFlush(source);
      source.stop();
      rejectOffer(new Error('offer failed'));
      await flushPromises();

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });

  describe('signaling', () => {
    it('should send ICE candidates to the server', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      pc.fireIceCandidate('candidate:1 1 udp 2 1.2.3.4 5 typ host');

      expect(channel.sent).toContainEqual({
        type: 'webrtc/candidate',
        value: 'candidate:1 1 udp 2 1.2.3.4 5 typ host',
      });
    });

    it('should send an empty candidate at end-of-candidates', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      pc.fireIceCandidate(null);

      expect(channel.sent).toContainEqual({ type: 'webrtc/candidate', value: '' });
    });

    it('should not send a candidate after stop', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      source.stop();

      const sentBefore = channel.sent.length;
      pc.fireIceCandidate('candidate:1 1 udp 2 1.2.3.4 5 typ host');

      expect(channel.sent).toHaveLength(sentBefore);
    });

    it('should apply the server answer', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      channel.receiveMessage({ type: 'webrtc/answer', value: 'v=0\r\nanswer' });

      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'v=0\r\nanswer',
      });
    });

    it('should swallow a rejected setRemoteDescription', async () => {
      const { source, channel, pc } = setup();
      pc.setRemoteDescription.mockRejectedValue(new Error('bad answer'));
      await startAndFlush(source);

      expect(() =>
        channel.receiveMessage({ type: 'webrtc/answer', value: 'v=0\r\nanswer' }),
      ).not.toThrow();
      await flushPromises();
    });

    it('should swallow a rejected addIceCandidate', async () => {
      const { source, channel, pc } = setup();
      pc.addIceCandidate.mockRejectedValue(new Error('bad candidate'));
      await startAndFlush(source);

      expect(() =>
        channel.receiveMessage({
          type: 'webrtc/candidate',
          value: 'candidate:1 1 udp 2 1.2.3.4 5 typ host',
        }),
      ).not.toThrow();
      await flushPromises();
    });

    it('should add server ICE candidates with a fixed sdpMid', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      channel.receiveMessage({
        type: 'webrtc/candidate',
        value: 'candidate:2 1 udp 1 5.6.7.8 9 typ host',
      });

      expect(pc.addIceCandidate).toHaveBeenCalledWith({
        candidate: 'candidate:2 1 udp 1 5.6.7.8 9 typ host',
        sdpMid: '0',
      });
    });

    it('should ignore an empty server ICE candidate', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      channel.receiveMessage({ type: 'webrtc/candidate', value: '' });

      expect(pc.addIceCandidate).not.toHaveBeenCalled();
    });

    it('should ignore messages with a non-string value', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      channel.receiveMessage({ type: 'webrtc/answer', value: 42 });

      expect(pc.setRemoteDescription).not.toHaveBeenCalled();
    });

    it('should ignore messages after the connection was replaced', async () => {
      const { source, channel, pc } = setup();
      await startAndFlush(source);
      source.stop();
      channel.receiveMessage({ type: 'webrtc/answer', value: 'v=0\r\nanswer' });

      expect(pc.setRemoteDescription).not.toHaveBeenCalled();
    });
  });

  describe('server errors', () => {
    it('should fail on a webrtc server error', async () => {
      const { source, channel, failedCallback } = setup();
      await startAndFlush(source);
      channel.receiveMessage({ type: 'error', value: 'webrtc/offer: stream not found' });

      expect(failedCallback).toHaveBeenCalledWith('server_error');
    });

    it('should ignore server errors for other modes', async () => {
      const { source, channel, failedCallback } = setup();
      await startAndFlush(source);
      channel.receiveMessage({ type: 'error', value: 'mse: stream not found' });

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });

  describe('connection', () => {
    it('should attach the received stream and report loaded', async () => {
      const { source, pc, video, loadedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');

      expect(video.srcObject).not.toBeNull();

      video.dispatchEvent(new Event('loadeddata'));
      expect(loadedCallback).toHaveBeenCalledTimes(1);
    });

    it('should only build the received stream once', async () => {
      const { source, pc, video } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');
      const firstStream = video.srcObject;
      pc.fireConnectionStateChange('connected');

      expect(video.srcObject).toBe(firstStream);
    });

    it('should fail when the connection fails', async () => {
      const { source, pc, failedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('failed');

      expect(failedCallback).toHaveBeenCalledWith('media_error');
    });

    it('should not fail on a recoverable disconnect', async () => {
      const { source, pc, failedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('disconnected');

      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should fail when a disconnect escalates to failed', async () => {
      const { source, pc, failedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('disconnected');
      pc.fireConnectionStateChange('failed');

      expect(failedCallback).toHaveBeenCalledWith('media_error');
    });

    it('should ignore intermediate connection states', async () => {
      const { source, pc, video, failedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connecting');

      expect(video.srcObject).toBeFalsy();
      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should ignore connection state changes after stop', async () => {
      const { source, pc, failedCallback } = setup();
      await startAndFlush(source);
      source.stop();
      pc.fireConnectionStateChange('failed');

      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should build the media stream with the global MediaStream by default', async () => {
      vi.stubGlobal('MediaStream', FakeMediaStream);
      const video = document.createElement('video');
      const channel = new FakeStreamSourceChannel();
      const pc = new FakeRTCPeerConnection();
      const source = new WebRTCStreamSource(
        {
          target: { kind: 'video', video },
          channel,
          callbacks: { loadedCallback: vi.fn(), failedCallback: vi.fn() },
        },
        async () => ICE_SERVERS,
        { createPeerConnection: () => pc.asPeerConnection() },
      );
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');

      expect(source.getMediaStream()).toBeInstanceOf(FakeMediaStream);
      vi.unstubAllGlobals();
    });
  });

  describe('connect timeout', () => {
    it('should fail if no frame decodes within the connect timeout', async () => {
      const { source, pc, failedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');
      // Connected, but the real video never fires loadeddata.
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).toHaveBeenCalledWith('connect_timeout');
    });

    it('should cancel the connect timeout once loaded', async () => {
      const { source, pc, video, failedCallback } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');
      video.dispatchEvent(new Event('loadeddata'));
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toHaveBeenCalledWith('connect_timeout');
    });
  });

  describe('lifecycle', () => {
    it('should close the connection on stop and clear the video', async () => {
      const { source, pc, video } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');
      source.stop();

      expect(pc.close).toHaveBeenCalled();
      expect(video.srcObject).toBeNull();
      expect(source.getMediaStream()).toBeNull();
    });

    it('should tolerate stopping before starting', () => {
      const { source } = setup();

      expect(() => source.stop()).not.toThrow();
    });
  });

  describe('reporting', () => {
    it('should expose the media stream and peer connection', async () => {
      const { source, pc } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');

      expect(source.getMediaStream()).not.toBeNull();
      expect(source.getPeerConnection()).toBe(pc.asPeerConnection());
    });

    it('should report its media capabilities', async () => {
      const { source, pc } = setup();
      await startAndFlush(source);
      pc.fireConnectionStateChange('connected');

      expect(source.getCapabilities()).toEqual({
        supportsPause: true,
        hasAudio: expect.any(Boolean),
      });
    });

    it('should report webrtc technology', () => {
      const { source } = setup();

      expect(source.getTechnology()).toEqual(['webrtc']);
    });

    it('should report a stream profile from the tracks and SDP', async () => {
      const { source, pc } = setup();
      await startAndFlush(source);
      pc.setRemoteDescription({ sdp: 'a=rtpmap:98 H265/90000\r\n' });
      pc.fireConnectionStateChange('connected');

      expect(source.getStreamProfile()).toEqual({
        hasVideo: true,
        hasH265Video: true,
        hasAudio: true,
        hasAACAudio: false,
      });
    });

    it('should report an empty profile before connection', async () => {
      const { source } = setup();
      await startAndFlush(source);

      expect(source.getStreamProfile()).toEqual({
        hasVideo: false,
        hasH265Video: false,
        hasAudio: false,
        hasAACAudio: false,
      });
    });
  });
});
