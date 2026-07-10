import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebRTCStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/webrtc';
import type { StreamSourceContext } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { flushPromises } from '../../../../../test-utils';
import {
  FakeMediaStream,
  FakeMediaStreamTrack,
  FakeRTCPeerConnection,
  FakeStreamSourceChannel,
} from '../test-utils';

// @vitest-environment jsdom
describe('WebRTCStreamSource', () => {
  const setup = (options?: { microphoneStream?: FakeMediaStream | null }) => {
    const video = document.createElement('video');
    const channel = new FakeStreamSourceChannel();
    const loadedCallback = vi.fn();
    const failedCallback = vi.fn();

    const context: StreamSourceContext = {
      video,
      channel,
      callbacks: { loadedCallback, failedCallback },
    };

    const pc = new FakeRTCPeerConnection();
    const createPeerConnection = vi.fn(() => pc.asPeerConnection());
    const source = new WebRTCStreamSource(context, {
      createPeerConnection,
      createMediaStream: (tracks) =>
        new FakeMediaStream(tracks as unknown as FakeMediaStreamTrack[]).asMediaStream(),
      microphoneStream: options?.microphoneStream?.asMediaStream() ?? null,
    });

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

  describe('transceivers', () => {
    it('should pre-arm a sendonly audio transceiver and recvonly video and audio', () => {
      const { source, pc } = setup();
      source.start();

      expect(pc.transceivers).toHaveLength(3);
      expect(pc.transceivers[0].direction).toBe('sendonly');
      expect(pc.transceivers[1].direction).toBe('recvonly');
      expect(pc.transceivers[2].direction).toBe('recvonly');

      // Kind-only pre-arm: no track, so no getUserMedia and no permission prompt.
      expect(pc.transceivers[0].sender.track).toBeNull();
    });

    it('should pre-arm with the current microphone track', () => {
      const micTrack = new FakeMediaStreamTrack('audio');
      const { source, pc } = setup({
        microphoneStream: new FakeMediaStream([micTrack]),
      });
      source.start();

      expect(pc.transceivers[0].sender.track).toBe(micTrack);
    });
  });

  describe('negotiation', () => {
    it('should send an offer after setting the local description', async () => {
      const { source, channel, pc } = setup();
      source.start();
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
      source.start();
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
      source.start();
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
      source.start();
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
      source.start();
      await flushPromises();

      expect(failedCallback).toHaveBeenCalledWith('media-error');
    });

    it('should ignore a negotiation error after the connection was replaced', async () => {
      const { source, pc, failedCallback } = setup();
      let rejectOffer: (reason: Error) => void = () => {};
      pc.createOffer.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectOffer = reject;
        }),
      );
      source.start();
      source.stop();
      rejectOffer(new Error('offer failed'));
      await flushPromises();

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });

  describe('signaling', () => {
    it('should send ICE candidates to the server', () => {
      const { source, channel, pc } = setup();
      source.start();
      pc.fireIceCandidate('candidate:1 1 udp 2 1.2.3.4 5 typ host');

      expect(channel.sent).toContainEqual({
        type: 'webrtc/candidate',
        value: 'candidate:1 1 udp 2 1.2.3.4 5 typ host',
      });
    });

    it('should send an empty candidate at end-of-candidates', () => {
      const { source, channel, pc } = setup();
      source.start();
      pc.fireIceCandidate(null);

      expect(channel.sent).toContainEqual({ type: 'webrtc/candidate', value: '' });
    });

    it('should apply the server answer', () => {
      const { source, channel, pc } = setup();
      source.start();
      channel.receiveMessage({ type: 'webrtc/answer', value: 'v=0\r\nanswer' });

      expect(pc.setRemoteDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'v=0\r\nanswer',
      });
    });

    it('should swallow a rejected setRemoteDescription', async () => {
      const { source, channel, pc } = setup();
      pc.setRemoteDescription.mockRejectedValue(new Error('bad answer'));
      source.start();

      expect(() =>
        channel.receiveMessage({ type: 'webrtc/answer', value: 'v=0\r\nanswer' }),
      ).not.toThrow();
      await flushPromises();
    });

    it('should swallow a rejected addIceCandidate', async () => {
      const { source, channel, pc } = setup();
      pc.addIceCandidate.mockRejectedValue(new Error('bad candidate'));
      source.start();

      expect(() =>
        channel.receiveMessage({
          type: 'webrtc/candidate',
          value: 'candidate:1 1 udp 2 1.2.3.4 5 typ host',
        }),
      ).not.toThrow();
      await flushPromises();
    });

    it('should add server ICE candidates with a fixed sdpMid', () => {
      const { source, channel, pc } = setup();
      source.start();
      channel.receiveMessage({
        type: 'webrtc/candidate',
        value: 'candidate:2 1 udp 1 5.6.7.8 9 typ host',
      });

      expect(pc.addIceCandidate).toHaveBeenCalledWith({
        candidate: 'candidate:2 1 udp 1 5.6.7.8 9 typ host',
        sdpMid: '0',
      });
    });

    it('should ignore an empty server ICE candidate', () => {
      const { source, channel, pc } = setup();
      source.start();
      channel.receiveMessage({ type: 'webrtc/candidate', value: '' });

      expect(pc.addIceCandidate).not.toHaveBeenCalled();
    });

    it('should ignore messages with a non-string value', () => {
      const { source, channel, pc } = setup();
      source.start();
      channel.receiveMessage({ type: 'webrtc/answer', value: 42 });

      expect(pc.setRemoteDescription).not.toHaveBeenCalled();
    });

    it('should ignore messages after the connection was replaced', () => {
      const { source, channel, pc } = setup();
      source.start();
      source.stop();
      channel.receiveMessage({ type: 'webrtc/answer', value: 'v=0\r\nanswer' });

      expect(pc.setRemoteDescription).not.toHaveBeenCalled();
    });
  });

  describe('server errors', () => {
    it('should fail on a webrtc server error', () => {
      const { source, channel, failedCallback } = setup();
      source.start();
      channel.receiveMessage({ type: 'error', value: 'webrtc/offer: stream not found' });

      expect(failedCallback).toHaveBeenCalledWith('server-error');
    });

    it('should ignore server errors for other modes', () => {
      const { source, channel, failedCallback } = setup();
      source.start();
      channel.receiveMessage({ type: 'error', value: 'mse: stream not found' });

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });

  describe('connection', () => {
    it('should attach the received stream and report loaded', () => {
      const { source, pc, video, loadedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('connected');

      expect(video.srcObject).not.toBeNull();

      video.dispatchEvent(new Event('loadeddata'));
      expect(loadedCallback).toHaveBeenCalledTimes(1);
    });

    it('should only build the received stream once', () => {
      const { source, pc, video } = setup();
      source.start();
      pc.fireConnectionStateChange('connected');
      const firstStream = video.srcObject;
      pc.fireConnectionStateChange('connected');

      expect(video.srcObject).toBe(firstStream);
    });

    it('should fail when the connection fails', () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('failed');

      expect(failedCallback).toHaveBeenCalledWith('media-error');
    });

    it('should not fail on a recoverable disconnect', () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('disconnected');

      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should fail when a disconnect escalates to failed', () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('disconnected');
      pc.fireConnectionStateChange('failed');

      expect(failedCallback).toHaveBeenCalledWith('media-error');
    });

    it('should ignore intermediate connection states', () => {
      const { source, pc, video, failedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('connecting');

      expect(video.srcObject).toBeFalsy();
      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should ignore connection state changes after stop', () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      source.stop();
      pc.fireConnectionStateChange('failed');

      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should build the media stream with the global MediaStream by default', () => {
      vi.stubGlobal('MediaStream', FakeMediaStream);
      const video = document.createElement('video');
      const channel = new FakeStreamSourceChannel();
      const pc = new FakeRTCPeerConnection();
      const source = new WebRTCStreamSource(
        {
          video,
          channel,
          callbacks: { loadedCallback: vi.fn(), failedCallback: vi.fn() },
        },
        { createPeerConnection: () => pc.asPeerConnection() },
      );
      source.start();
      pc.fireConnectionStateChange('connected');

      expect(source.getMediaStream()).toBeInstanceOf(FakeMediaStream);
      vi.unstubAllGlobals();
    });
  });

  describe('connect timeout', () => {
    it('should fail if no frame decodes within the connect timeout', () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('connected');
      // Connected, but the real video never fires loadeddata.
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).toHaveBeenCalledWith('connect-timeout');
    });

    it('should cancel the connect timeout once loaded', () => {
      const { source, pc, video, failedCallback } = setup();
      source.start();
      pc.fireConnectionStateChange('connected');
      video.dispatchEvent(new Event('loadeddata'));
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toHaveBeenCalledWith('connect-timeout');
    });
  });

  describe('lifecycle', () => {
    it('should close the connection on stop and clear the video', () => {
      const { source, pc, video } = setup();
      source.start();
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
    it('should expose the media stream and peer connection', () => {
      const { source, pc } = setup();
      source.start();
      pc.fireConnectionStateChange('connected');

      expect(source.getMediaStream()).not.toBeNull();
      expect(source.getPeerConnection()).toBe(pc.asPeerConnection());
    });

    it('should report webrtc technology', () => {
      const { source } = setup();

      expect(source.getTechnology()).toEqual(['webrtc']);
    });

    it('should report a stream profile from the tracks and SDP', () => {
      const { source, pc } = setup();
      source.start();
      pc.setRemoteDescription({ sdp: 'a=rtpmap:98 H265/90000\r\n' });
      pc.fireConnectionStateChange('connected');

      expect(source.getStreamProfile()).toEqual({
        hasVideo: true,
        hasH265Video: true,
        hasAudio: true,
        hasAACAudio: false,
      });
    });

    it('should report an empty profile before connection', () => {
      const { source } = setup();
      source.start();

      expect(source.getStreamProfile()).toEqual({
        hasVideo: false,
        hasH265Video: false,
        hasAudio: false,
        hasAACAudio: false,
      });
    });

    it('should report 2-way audio capability once a mic track is armed', () => {
      const micTrack = new FakeMediaStreamTrack('audio');
      const { source, pc } = setup({
        microphoneStream: new FakeMediaStream([micTrack]),
      });
      source.start();
      pc.fireConnectionStateChange('connected');

      expect(source.getCapabilities().has2WayAudio).toBe(true);
      expect(source.getCapabilities().supportsPause).toBe(true);
    });
  });

  describe('setMicrophoneStream', () => {
    it('should do nothing for an unchanged stream', async () => {
      const stream = new FakeMediaStream([new FakeMediaStreamTrack('audio')]);
      const { source, pc } = setup({ microphoneStream: stream });
      source.start();
      await source.setMicrophoneStream(stream.asMediaStream());

      expect(pc.getMicrophoneTransceiver().sender.replaceTrack).not.toHaveBeenCalled();
    });

    it('should replace the outbound track without renegotiating', async () => {
      const { source, pc } = setup();
      source.start();
      const newTrack = new FakeMediaStreamTrack('audio');
      await source.setMicrophoneStream(new FakeMediaStream([newTrack]).asMediaStream());

      expect(pc.getMicrophoneTransceiver().sender.replaceTrack).toHaveBeenCalledWith(
        newTrack,
      );
    });

    it('should clear the outbound track for a null stream', async () => {
      const stream = new FakeMediaStream([new FakeMediaStreamTrack('audio')]);
      const { source, pc } = setup({ microphoneStream: stream });
      source.start();
      await source.setMicrophoneStream(null);

      expect(pc.getMicrophoneTransceiver().sender.replaceTrack).toHaveBeenCalledWith(
        null,
      );
    });

    it('should do nothing before there is a peer connection', async () => {
      const { source, failedCallback } = setup();
      await source.setMicrophoneStream(
        new FakeMediaStream([new FakeMediaStreamTrack('audio')]).asMediaStream(),
      );

      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should fail when a current replaceTrack rejects', async () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      pc.getMicrophoneTransceiver().sender.replaceTrack.mockRejectedValue(
        new Error('replace failed'),
      );
      await source.setMicrophoneStream(
        new FakeMediaStream([new FakeMediaStreamTrack('audio')]).asMediaStream(),
      );

      expect(failedCallback).toHaveBeenCalledWith('2-way-audio-error');
    });

    it('should ignore a stale replaceTrack rejection after stop', async () => {
      const { source, pc, failedCallback } = setup();
      source.start();
      let rejectReplace: (reason: Error) => void = () => {};
      pc.getMicrophoneTransceiver().sender.replaceTrack.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectReplace = reject;
        }),
      );
      const promise = source.setMicrophoneStream(
        new FakeMediaStream([new FakeMediaStreamTrack('audio')]).asMediaStream(),
      );
      source.stop();
      rejectReplace(new Error('replace failed'));
      await promise;

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });
});
