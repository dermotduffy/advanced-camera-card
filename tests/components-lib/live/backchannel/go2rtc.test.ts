import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Go2RTCBackchannel } from '../../../../src/components-lib/live/backchannel/go2rtc';
import type { BackchannelErrorCallback } from '../../../../src/components-lib/live/backchannel/types';
import {
  resolveEndpointURL,
  type ResolvedEndpoint,
} from '../../../../src/ha/resolve-endpoint';
import type { HomeAssistant } from '../../../../src/ha/types';
import {
  FakeMediaStream,
  FakeMediaStreamTrack,
  FakeRTCPeerConnection,
  FakeWebSocket,
} from '../../../go2rtc/test-utils';
import { flushPromises } from '../../../test-utils';

vi.mock('../../../../src/ha/resolve-endpoint');

const createStream = (): FakeMediaStream =>
  new FakeMediaStream([new FakeMediaStreamTrack('audio')]);

const setup = (options?: { errorCallback?: BackchannelErrorCallback }) => {
  const pc = new FakeRTCPeerConnection();
  const websocket = new FakeWebSocket();
  const backchannel = new Go2RTCBackchannel(
    mock<HomeAssistant>(),
    { endpoint: '/local/api/ws?src=camera', sign: true },
    undefined,
    {
      createPeerConnection: () => pc.asPeerConnection(),
      createWebSocket: () => websocket.asWebSocket(),
      ...(options?.errorCallback && { errorCallback: options.errorCallback }),
    },
  );
  return { backchannel, pc, websocket };
};

// Drives a successful negotiation up to (but not including) the point the
// caller chooses to complete or fail it.
const negotiate = async (websocket: FakeWebSocket) => {
  await flushPromises();
  websocket.fireOpen();
  await flushPromises();
  websocket.fireMessage(JSON.stringify({ type: 'webrtc/answer', value: 'v=0\r\n' }));
  await flushPromises();
};

const connect = async (pc: FakeRTCPeerConnection, websocket: FakeWebSocket) => {
  await negotiate(websocket);
  pc.fireConnectionStateChange('connected');
  await flushPromises();
};

// @vitest-environment jsdom
describe('Go2RTCBackchannel', () => {
  beforeEach(() => {
    vi.mocked(resolveEndpointURL).mockResolvedValue({
      success: true,
      url: 'http://go2rtc/api/ws',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('should offer exactly one outbound audio slot and no video', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      expect(pc.transceivers).toHaveLength(1);
      expect(pc.transceivers[0].direction).toBe('sendonly');
      expect(pc.transceivers[0].sender.track?.kind).toBe('audio');
    });

    it('should resolve only once the camera is reachable', async () => {
      const { backchannel, pc, websocket } = setup();
      let resolved = false;
      const started = backchannel.start(createStream().asMediaStream()).then(() => {
        resolved = true;
      });

      await negotiate(websocket);
      expect(resolved).toBe(false);

      pc.fireConnectionStateChange('connected');
      await started;
      expect(resolved).toBe(true);
    });

    it('should send the offer over the signaling channel', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      expect(websocket.sent.map((message) => JSON.parse(message).type)).toContain(
        'webrtc/offer',
      );
    });

    it('should reject when the microphone has no audio track', async () => {
      const { backchannel } = setup();
      await expect(
        backchannel.start(new FakeMediaStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
    });

    it('should reject when the microphone track has already ended', async () => {
      const { backchannel } = setup();
      const track = new FakeMediaStreamTrack('audio');
      track.readyState = 'ended';
      await expect(
        backchannel.start(new FakeMediaStream([track]).asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
    });

    it('should reject when the address cannot be resolved', async () => {
      vi.mocked(resolveEndpointURL).mockResolvedValue({
        success: false,
        error: 'proxy',
      });
      const { backchannel } = setup();
      await expect(
        backchannel.start(createStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'failed', description: 'proxy' });
    });

    it('should reject when the server reports the stream cannot take audio', async () => {
      const { backchannel, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(
        JSON.stringify({ type: 'error', value: 'webrtc: no backchannel' }),
      );
      await expect(started).rejects.toMatchObject({
        reason: 'no_two_way_audio',
        description: 'webrtc: no backchannel',
      });
    });

    it('should reject when the camera declines to receive audio', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await negotiate(websocket);
      pc.getMicrophoneTransceiver().currentDirection = 'inactive';
      pc.fireConnectionStateChange('connected');
      await expect(started).rejects.toMatchObject({ reason: 'no_two_way_audio' });
    });

    it('should reject when the signaling channel closes before connecting', async () => {
      const { backchannel, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireClose();
      await expect(started).rejects.toMatchObject({ reason: 'failed' });
    });

    it('should reject when the peer connection fails', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await negotiate(websocket);
      pc.fireConnectionStateChange('failed');
      await expect(started).rejects.toMatchObject({ reason: 'failed' });
    });

    it('should reject when the camera is not reached in time', async () => {
      vi.useFakeTimers();
      const { backchannel, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      vi.advanceTimersByTime(10 * 1000);
      await expect(started).rejects.toMatchObject({ reason: 'failed' });
      vi.useRealTimers();
    });

    it('should reject when the offer cannot be created', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.createOffer.mockRejectedValue(new Error('no media'));
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: 'no media',
      });
    });

    it('should close the signaling channel once connected', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      expect(websocket.close).toHaveBeenCalled();
      expect(pc.close).not.toHaveBeenCalled();
    });

    it('should send ICE candidates and signal the end of them', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();

      pc.fireIceCandidate('candidate:1');
      pc.fireIceCandidate(null);

      const candidates = websocket.sent
        .map((message) => JSON.parse(message))
        .filter((message) => message.type === 'webrtc/candidate')
        .map((message) => message.value);
      expect(candidates).toEqual(['candidate:1', '']);

      await connect(pc, websocket);
      await started;
    });

    it('should apply candidates from the server', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(
        JSON.stringify({ type: 'webrtc/candidate', value: 'candidate:2' }),
      );
      await flushPromises();

      expect(pc.addIceCandidate).toHaveBeenCalledWith({
        candidate: 'candidate:2',
        sdpMid: '0',
      });

      await connect(pc, websocket);
      await started;
    });
  });

  describe('after connecting', () => {
    it('should report a peer connection that later fails', async () => {
      const errorCallback = vi.fn();
      const { backchannel, pc, websocket } = setup({ errorCallback });
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      pc.fireConnectionStateChange('failed');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'failed' }),
      );
    });

    it('should release the camera when the peer connection later fails', async () => {
      const stream = createStream();
      const { backchannel, pc, websocket } = setup({ errorCallback: vi.fn() });
      const started = backchannel.start(stream.asMediaStream());
      await connect(pc, websocket);
      await started;

      pc.fireConnectionStateChange('failed');

      expect(pc.close).toHaveBeenCalled();
      expect(stream.getAudioTracks()[0].readyState).toBe('live');
    });

    it('should ignore the signaling channel closing', async () => {
      const errorCallback = vi.fn();
      const { backchannel, pc, websocket } = setup({ errorCallback });
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      websocket.fireClose();
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('setStream', () => {
    it('should swap the outbound track without reconnecting', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      const replacement = createStream();
      await backchannel.setStream(replacement.asMediaStream());

      expect(pc.getMicrophoneTransceiver().sender.replaceTrack).toHaveBeenCalledWith(
        replacement.getAudioTracks()[0],
      );
      expect(pc.close).not.toHaveBeenCalled();
    });

    it('should do nothing without an established path', async () => {
      const { backchannel } = setup();
      await expect(
        backchannel.setStream(createStream().asMediaStream()),
      ).resolves.toBeUndefined();
    });
  });

  describe('stop', () => {
    it('should close the connection but leave the microphone running', async () => {
      const { backchannel, pc, websocket } = setup();
      const stream = createStream();
      const started = backchannel.start(stream.asMediaStream());
      await connect(pc, websocket);
      await started;

      backchannel.stop();

      expect(pc.close).toHaveBeenCalled();
      expect(stream.getAudioTracks()[0].readyState).toBe('live');
    });

    it('should not report a peer connection that fails after being stopped', async () => {
      const errorCallback = vi.fn();
      const { backchannel, pc, websocket } = setup({ errorCallback });
      const started = backchannel.start(createStream().asMediaStream());
      await negotiate(websocket);

      backchannel.stop();
      pc.fireConnectionStateChange('failed');
      await flushPromises();

      await expect(started).rejects.toMatchObject({ reason: 'abandoned' });
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });
  describe('losing the microphone', () => {
    const endTrack = (stream: FakeMediaStream): void => {
      const track = stream.getAudioTracks()[0];
      track.readyState = 'ended';
      track.dispatchEvent(new Event('ended'));
    };

    it('should fail a start whose microphone ends before connecting', async () => {
      const stream = createStream();
      const { backchannel, websocket } = setup();
      const started = backchannel.start(stream.asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();

      endTrack(stream);

      await expect(started).rejects.toMatchObject({ reason: 'no_microphone' });
    });

    it('should release the camera and report when the microphone ends mid-call', async () => {
      const errorCallback = vi.fn();
      const stream = createStream();
      const { backchannel, pc, websocket } = setup({ errorCallback });
      const started = backchannel.start(stream.asMediaStream());
      await connect(pc, websocket);
      await started;

      endTrack(stream);

      expect(pc.close).toHaveBeenCalled();
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'no_microphone' }),
      );
    });

    it('should stop watching a microphone that has been replaced', async () => {
      const stream = createStream();
      const errorCallback = vi.fn();
      const { backchannel, pc, websocket } = setup({ errorCallback });
      const started = backchannel.start(stream.asMediaStream());
      await connect(pc, websocket);
      await started;

      await backchannel.setStream(createStream().asMediaStream());
      endTrack(stream);

      expect(errorCallback).not.toHaveBeenCalled();
      expect(pc.close).not.toHaveBeenCalled();
    });

    it('should stop watching the microphone once stopped', async () => {
      const stream = createStream();
      const errorCallback = vi.fn();
      const { backchannel, pc, websocket } = setup({ errorCallback });
      const started = backchannel.start(stream.asMediaStream());
      await connect(pc, websocket);
      await started;

      backchannel.stop();
      endTrack(stream);

      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('stale and defensive paths', () => {
    it('should use the browser factories when none are supplied', async () => {
      const pc = new FakeRTCPeerConnection();
      const websocket = new FakeWebSocket();
      vi.stubGlobal('RTCPeerConnection', function () {
        return pc.asPeerConnection();
      });
      vi.stubGlobal('WebSocket', function () {
        return websocket.asWebSocket();
      });

      const backchannel = new Go2RTCBackchannel(mock<HomeAssistant>(), {
        endpoint: '/local/api/ws?src=camera',
      });
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      expect(pc.transceivers).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it('should time out an address resolution that never returns', async () => {
      vi.useFakeTimers();
      vi.mocked(resolveEndpointURL).mockReturnValue(new Promise(() => {}));

      const { backchannel } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      vi.advanceTimersByTime(10 * 1000);

      await expect(started).rejects.toMatchObject({ reason: 'failed' });
      vi.useRealTimers();
    });

    it('should reject with a reason and release the connection when setup throws', async () => {
      const { backchannel, pc } = setup();
      pc.addTransceiver = () => {
        throw new Error('bad track');
      };

      await expect(
        backchannel.start(createStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'failed', description: 'bad track' });
      expect(pc.close).toHaveBeenCalled();
    });

    it('should reject without a description when setup throws something not error-like', async () => {
      const { backchannel, pc } = setup();
      pc.addTransceiver = () => {
        throw 'a bare string';
      };

      await expect(
        backchannel.start(createStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'failed', description: null });
    });

    it('should abandon a start stopped while the address resolves', async () => {
      let release: (value: ResolvedEndpoint) => void = () => {};
      vi.mocked(resolveEndpointURL).mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      const { backchannel, pc } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      backchannel.stop();
      release({ success: true, url: 'http://go2rtc/api/ws' });
      await flushPromises();

      await expect(started).rejects.toMatchObject({ reason: 'abandoned' });
      expect(pc.transceivers).toHaveLength(0);
    });

    it('should not send candidates after being stopped', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      const before = websocket.sent.length;

      backchannel.stop();
      pc.fireIceCandidate('candidate:late');

      expect(websocket.sent).toHaveLength(before);
      await expect(started).rejects.toThrow();
    });

    it('should not negotiate after being stopped', async () => {
      const { backchannel, pc, websocket } = setup();
      let releaseOffer: (value: { type: string; sdp?: string }) => void = () => {};
      pc.createOffer.mockReturnValue(
        new Promise((resolve) => {
          releaseOffer = resolve;
        }),
      );
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();

      backchannel.stop();
      releaseOffer({ type: 'offer', sdp: 'v=0' });
      await flushPromises();

      expect(pc.setLocalDescription).not.toHaveBeenCalled();
      await expect(started).rejects.toThrow();
    });

    it('should not send an offer when the local description is stopped mid-flight', async () => {
      const { backchannel, pc, websocket } = setup();
      let releaseLocal: () => void = () => {};
      pc.setLocalDescription.mockReturnValue(
        new Promise<void>((resolve) => {
          releaseLocal = resolve;
        }),
      );
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();

      backchannel.stop();
      releaseLocal();
      await flushPromises();

      expect(
        websocket.sent.filter((m) => JSON.parse(m).type === 'webrtc/offer'),
      ).toHaveLength(0);
      await expect(started).rejects.toThrow();
    });

    it('should send an empty offer when the browser produces no SDP', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.createOffer.mockResolvedValue({ type: 'offer' });
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      const offer = websocket.sent
        .map((m) => JSON.parse(m))
        .find((m) => m.type === 'webrtc/offer');
      expect(offer.value).toBe('');
    });

    it('should reject without a description when a negotiation failure is not error-like', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.createOffer.mockRejectedValue('a bare string');
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: null,
      });
    });

    it('should describe a negotiation failure by its name when it carries no message', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.createOffer.mockRejectedValue({ name: 'InvalidStateError' });
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: 'InvalidStateError',
      });
    });

    it('should reject when the answer cannot be applied', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.setRemoteDescription.mockRejectedValue(new Error('bad sdp'));
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(JSON.stringify({ type: 'webrtc/answer', value: 'v=0' }));
      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: 'bad sdp',
      });
    });

    it('should ignore messages without a string payload', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(JSON.stringify({ type: 'webrtc/answer', value: 42 }));
      await flushPromises();

      expect(pc.setRemoteDescription).not.toHaveBeenCalled();
      await connect(pc, websocket);
      await started;
    });

    it('should tolerate a candidate the browser rejects', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.addIceCandidate.mockRejectedValue(new Error('bad candidate'));
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(
        JSON.stringify({ type: 'webrtc/candidate', value: 'candidate:3' }),
      );
      await flushPromises();

      await connect(pc, websocket);
      await expect(started).resolves.toBeUndefined();
    });

    it('should ignore an empty candidate from the server', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(JSON.stringify({ type: 'webrtc/candidate', value: '' }));
      await flushPromises();

      expect(pc.addIceCandidate).not.toHaveBeenCalled();
      await connect(pc, websocket);
      await started;
    });

    it('should ignore messages after being stopped', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();

      backchannel.stop();
      websocket.fireMessage(JSON.stringify({ type: 'webrtc/answer', value: 'v=0' }));
      await flushPromises();

      expect(pc.setRemoteDescription).not.toHaveBeenCalled();
      await expect(started).rejects.toThrow();
    });

    it('should ignore intermediate connection states', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await negotiate(websocket);

      pc.fireConnectionStateChange('connecting');
      await flushPromises();
      expect(websocket.close).not.toHaveBeenCalled();

      pc.fireConnectionStateChange('connected');
      await started;
    });

    it('should reject a replacement carrying no audio', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      await expect(
        backchannel.setStream(new FakeMediaStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
      expect(pc.getMicrophoneTransceiver().sender.replaceTrack).not.toHaveBeenCalled();
    });

    it('should reject a replacement whose track has ended', async () => {
      const { backchannel, pc, websocket } = setup();
      const started = backchannel.start(createStream().asMediaStream());
      await connect(pc, websocket);
      await started;

      const track = new FakeMediaStreamTrack('audio');
      track.readyState = 'ended';
      await expect(
        backchannel.setStream(new FakeMediaStream([track]).asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
    });
    it('should reject without a description when an answer failure names nothing', async () => {
      const { backchannel, pc, websocket } = setup();
      pc.setRemoteDescription.mockRejectedValue({});
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();
      websocket.fireMessage(JSON.stringify({ type: 'webrtc/answer', value: 'v=0' }));
      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: null,
      });
    });

    it('should ignore a negotiation failure that arrives after being stopped', async () => {
      const { backchannel, pc, websocket } = setup();
      let rejectOffer: (error: unknown) => void = () => {};
      pc.createOffer.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectOffer = reject;
        }),
      );
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      websocket.fireOpen();
      await flushPromises();

      backchannel.stop();
      await expect(started).rejects.toMatchObject({ reason: 'abandoned' });

      rejectOffer(new Error('too late'));
      await flushPromises();
    });
  });
});
