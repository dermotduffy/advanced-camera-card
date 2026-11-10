import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { HABackchannel } from '../../../../src/components-lib/live/backchannel/ha';
import {
  BackchannelAbandonedError,
  type BackchannelErrorCallback,
} from '../../../../src/components-lib/live/backchannel/types';
import type { HomeAssistant } from '../../../../src/ha/types';
import {
  FakeMediaStream,
  FakeMediaStreamTrack,
  FakeRTCPeerConnection,
} from '../../../go2rtc/test-utils';
import { createHASS, flushPromises } from '../../../test-utils';

const ICE_SERVERS = [{ urls: ['stun:stun.example.com:3478'] }];

const createStream = (): FakeMediaStream =>
  new FakeMediaStream([new FakeMediaStreamTrack('audio')]);

interface Setup {
  backchannel: HABackchannel;
  hass: HomeAssistant;
  pc: FakeRTCPeerConnection;
  unsubscribe: Mock<() => Promise<void>>;
  createPeerConnection: Mock<() => RTCPeerConnection>;
  // Sends an event on the `camera/webrtc/offer` subscription.
  fireEvent: (event: unknown) => void;
  // Reports the Home Assistant websocket as disconnected.
  fireDisconnected: () => void;
}

const setup = (options?: { errorCallback?: BackchannelErrorCallback }): Setup => {
  const hass = createHASS();
  hass.connection.addEventListener = vi.fn();
  hass.connection.removeEventListener = vi.fn();
  vi.mocked(hass.callWS).mockImplementation(async (message) =>
    message.type === 'camera/webrtc/get_client_config'
      ? { configuration: { iceServers: ICE_SERVERS } }
      : null,
  );

  let callback: ((event: unknown) => void) | null = null;
  const unsubscribe = vi.fn<() => Promise<void>>(() => Promise.resolve());
  vi.mocked(hass.connection.subscribeMessage).mockImplementation(async (cb) => {
    callback = cb;
    return unsubscribe;
  });

  const pc = new FakeRTCPeerConnection();
  const createPeerConnection = vi.fn<() => RTCPeerConnection>(() =>
    pc.asPeerConnection(),
  );
  const backchannel = new HABackchannel(hass, 'camera.office', {
    createPeerConnection,
    ...(options?.errorCallback && { errorCallback: options.errorCallback }),
  });
  return {
    backchannel,
    hass,
    pc,
    unsubscribe,
    createPeerConnection,
    fireEvent: (event) => callback?.(event),
    fireDisconnected: () =>
      vi
        .mocked(hass.connection.addEventListener)
        .mock.calls.filter(([type]) => type === 'disconnected')
        .forEach(([, listener]) => listener(hass.connection, undefined)),
  };
};

// Drives a negotiation up to (but not including) the connection state change.
const negotiate = async (s: Setup) => {
  await flushPromises();
  s.fireEvent({ type: 'session', session_id: 'session-1' });
  s.fireEvent({ type: 'answer', answer: 'v=0\r\nanswer' });
  await flushPromises();
};

const connect = async (s: Setup) => {
  await negotiate(s);
  s.pc.fireConnectionStateChange('connected');
  await flushPromises();
};

const candidateCalls = (hass: HomeAssistant) =>
  vi
    .mocked(hass.callWS)
    .mock.calls.map(([message]) => message)
    .filter((message) => message.type === 'camera/webrtc/candidate');

// @vitest-environment jsdom
describe('HABackchannel', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('should offer exactly one outbound audio slot and no video', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(s.pc.transceivers).toHaveLength(1);
      expect(s.pc.transceivers[0].direction).toBe('sendonly');
      expect(s.pc.transceivers[0].sender.track?.kind).toBe('audio');
    });

    it('should use the peer connection settings of the camera', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(s.createPeerConnection).toHaveBeenCalledWith({ iceServers: ICE_SERVERS });
    });

    it('should open the data channel the camera asks for before offering', async () => {
      const s = setup();
      vi.mocked(s.hass.callWS).mockImplementation(async (message) =>
        message.type === 'camera/webrtc/get_client_config'
          ? { configuration: { iceServers: ICE_SERVERS }, dataChannel: 'camera' }
          : null,
      );
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(s.createPeerConnection).toHaveBeenCalledWith({ iceServers: ICE_SERVERS });
      expect(s.pc.createDataChannel).toHaveBeenCalledWith('camera');
      expect(s.pc.createDataChannel.mock.invocationCallOrder[0]).toBeLessThan(
        s.pc.createOffer.mock.invocationCallOrder[0],
      );
    });

    it('should not open a data channel the camera does not ask for', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(s.pc.createDataChannel).not.toHaveBeenCalled();
    });

    it('should send the offer through Home Assistant', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(s.hass.connection.subscribeMessage).toHaveBeenCalledWith(
        expect.any(Function),
        {
          type: 'camera/webrtc/offer',
          entity_id: 'camera.office',
          offer: 'v=0\r\noffer',
        },
        { resubscribe: false },
      );
      expect(s.pc.setRemoteDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'v=0\r\nanswer',
      });
    });

    it('should send an empty offer when the browser makes one without SDP', async () => {
      const s = setup();
      s.pc.createOffer.mockResolvedValue({ type: 'offer' });
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(s.hass.connection.subscribeMessage).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ offer: '' }),
        { resubscribe: false },
      );
    });

    it('should resolve only once the camera is reachable', async () => {
      const s = setup();
      let resolved = false;
      const started = s.backchannel.start(createStream().asMediaStream()).then(() => {
        resolved = true;
      });

      await negotiate(s);
      expect(resolved).toBe(false);

      s.pc.fireConnectionStateChange('connected');
      await started;
      expect(resolved).toBe(true);
    });

    it('should reject when the microphone has no audio track', async () => {
      const s = setup();
      await expect(
        s.backchannel.start(new FakeMediaStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
    });

    it('should reject when the microphone track has already ended', async () => {
      const s = setup();
      const track = new FakeMediaStreamTrack('audio');
      track.readyState = 'ended';
      await expect(
        s.backchannel.start(new FakeMediaStream([track]).asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
    });

    it('should reject when Home Assistant has no WebRTC for the camera', async () => {
      const s = setup();
      vi.mocked(s.hass.callWS).mockRejectedValue(
        new Error('webrtc_get_client_config_failed'),
      );
      await expect(
        s.backchannel.start(createStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'failed' });
    });

    it('should reject when Home Assistant refuses the offer', async () => {
      const s = setup();
      vi.mocked(s.hass.connection.subscribeMessage).mockRejectedValue(
        new Error('webrtc_offer_failed'),
      );
      await expect(
        s.backchannel.start(createStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'failed', description: 'webrtc_offer_failed' });
    });

    it('should reject when the offer cannot be made', async () => {
      const s = setup();
      s.pc.createOffer.mockRejectedValue(new Error('no codecs'));
      await expect(
        s.backchannel.start(createStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'failed', description: 'no codecs' });
    });

    it("should use the browser's peer connection without options", async () => {
      const s = setup();
      const pc = new FakeRTCPeerConnection();
      vi.stubGlobal('RTCPeerConnection', function () {
        return pc.asPeerConnection();
      });

      const backchannel = new HABackchannel(s.hass, 'camera.office');
      const started = backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.fireEvent({ type: 'session', session_id: 'session-1' });
      s.fireEvent({ type: 'answer', answer: 'v=0' });
      await flushPromises();
      pc.fireConnectionStateChange('connected');
      await started;

      expect(pc.transceivers).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it('should reject without a description when the answer fails without one', async () => {
      const s = setup();
      s.pc.setRemoteDescription.mockRejectedValue(null);
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);

      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: null,
      });
    });

    it('should reject when the answer cannot be applied', async () => {
      const s = setup();
      s.pc.setRemoteDescription.mockRejectedValue(new Error('bad answer'));
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);

      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: 'bad answer',
      });
    });

    it('should reject with the reason Home Assistant gives', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.fireEvent({ type: 'error', code: 'webrtc_offer_failed', message: 'no stream' });

      await expect(started).rejects.toMatchObject({
        reason: 'failed',
        description: 'no stream',
      });
      expect(s.unsubscribe).toHaveBeenCalled();
      expect(s.pc.close).toHaveBeenCalled();
    });

    it('should reject when the camera does not take audio', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.pc.transceivers[0].currentDirection = 'inactive';
      s.pc.fireConnectionStateChange('connected');

      await expect(started).rejects.toMatchObject({ reason: 'no_two_way_audio' });
    });

    it('should reject when the connection fails before it is up', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.pc.fireConnectionStateChange('failed');

      await expect(started).rejects.toMatchObject({ reason: 'failed' });
    });

    it('should reject when the camera is not reachable in time', async () => {
      vi.useFakeTimers();
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      const assertion = expect(started).rejects.toMatchObject({ reason: 'failed' });

      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
    });

    it('should abandon an earlier start', async () => {
      const s = setup();
      const first = s.backchannel.start(createStream().asMediaStream());
      const second = s.backchannel.start(createStream().asMediaStream());

      await expect(first).rejects.toBeInstanceOf(BackchannelAbandonedError);
      await connect(s);
      await expect(second).resolves.toBeUndefined();
    });
  });

  describe('Home Assistant disconnects', () => {
    it('should end the call without unsubscribing on the new connection', async () => {
      const errorCallback = vi.fn();
      const s = setup({ errorCallback });
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      s.fireDisconnected();
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'disconnected' }),
      );
      expect(s.unsubscribe).not.toHaveBeenCalled();
      expect(s.pc.close).toHaveBeenCalled();
    });

    it('should fail a start whose subscription was pending', async () => {
      const s = setup();
      let release: (unsubscribe: () => Promise<void>) => void = () => {};
      vi.mocked(s.hass.connection.subscribeMessage).mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.fireDisconnected();
      await expect(started).rejects.toMatchObject({ reason: 'disconnected' });

      release(s.unsubscribe);
      await flushPromises();
      expect(s.unsubscribe).not.toHaveBeenCalled();
    });

    it('should stop watching the connection once stopped', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      s.backchannel.stop();
      expect(s.hass.connection.removeEventListener).toHaveBeenCalledWith(
        'disconnected',
        vi.mocked(s.hass.connection.addEventListener).mock.calls[0][1],
      );
    });
  });

  describe('abandoned while starting', () => {
    it('should stop after fetching the client configuration', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      s.backchannel.stop();

      await expect(started).rejects.toBeInstanceOf(BackchannelAbandonedError);
      await flushPromises();
      expect(s.createPeerConnection).not.toHaveBeenCalled();
    });

    it.each([['createOffer' as const], ['setLocalDescription' as const]])(
      'should stop while %s is pending',
      async (step) => {
        const s = setup();
        let release: () => void = () => {};
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        if (step === 'createOffer') {
          s.pc.createOffer.mockImplementation(async () => {
            await pending;
            return { type: 'offer', sdp: 'v=0\r\noffer' };
          });
        } else {
          s.pc.setLocalDescription.mockImplementation(() => pending);
        }
        const started = s.backchannel.start(createStream().asMediaStream());
        await flushPromises();
        s.backchannel.stop();
        release();

        await expect(started).rejects.toBeInstanceOf(BackchannelAbandonedError);
        await flushPromises();
        expect(s.hass.connection.subscribeMessage).not.toHaveBeenCalled();
      },
    );

    it('should end a subscription that arrives after the stop', async () => {
      const s = setup();
      let release: (unsubscribe: () => Promise<void>) => void = () => {};
      vi.mocked(s.hass.connection.subscribeMessage).mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.backchannel.stop();
      release(s.unsubscribe);

      await expect(started).rejects.toBeInstanceOf(BackchannelAbandonedError);
      await flushPromises();
      expect(s.unsubscribe).toHaveBeenCalled();
    });

    it('should not fail when that late subscription cannot be ended', async () => {
      const s = setup();
      let release: (unsubscribe: () => Promise<void>) => void = () => {};
      vi.mocked(s.hass.connection.subscribeMessage).mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.backchannel.stop();
      release(() => Promise.reject(new Error('connection lost')));

      await expect(started).rejects.toBeInstanceOf(BackchannelAbandonedError);
    });
  });

  describe('candidates', () => {
    it('should hold candidates until the session is known', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.pc.fireIceCandidate('candidate:early');
      expect(candidateCalls(s.hass)).toHaveLength(0);

      s.fireEvent({ type: 'session', session_id: 'session-1' });
      s.pc.fireIceCandidate('candidate:late');
      expect(candidateCalls(s.hass)).toEqual([
        {
          type: 'camera/webrtc/candidate',
          entity_id: 'camera.office',
          session_id: 'session-1',
          candidate: {
            candidate: 'candidate:early',
            sdpMid: undefined,
            sdpMLineIndex: undefined,
          },
        },
        {
          type: 'camera/webrtc/candidate',
          entity_id: 'camera.office',
          session_id: 'session-1',
          candidate: {
            candidate: 'candidate:late',
            sdpMid: undefined,
            sdpMLineIndex: undefined,
          },
        },
      ]);

      s.fireEvent({ type: 'answer', answer: 'v=0' });
      s.pc.fireConnectionStateChange('connected');
      await started;
    });

    it('should not send the end of candidates', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.pc.fireIceCandidate(null);
      s.pc.fireIceCandidate('');
      expect(candidateCalls(s.hass)).toHaveLength(0);

      s.pc.fireConnectionStateChange('connected');
      await started;
    });

    it('should carry on when Home Assistant refuses a candidate', async () => {
      const s = setup();
      vi.mocked(s.hass.callWS).mockImplementation(async (message) => {
        if (message.type === 'camera/webrtc/candidate') {
          throw new Error('refused');
        }
        return { configuration: { iceServers: ICE_SERVERS } };
      });
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.pc.fireIceCandidate('candidate:1');
      await flushPromises();

      s.pc.fireConnectionStateChange('connected');
      await expect(started).resolves.toBeUndefined();
    });

    it("should add the camera's candidates", async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.fireEvent({
        type: 'candidate',
        candidate: { candidate: 'candidate:2', sdpMid: '0', sdpMLineIndex: 0 },
      });
      s.fireEvent({ type: 'candidate', candidate: { candidate: 'candidate:3' } });
      s.fireEvent({
        type: 'candidate',
        candidate: { candidate: 'candidate:4', sdpMLineIndex: 1 },
      });
      s.fireEvent({
        type: 'candidate',
        candidate: { candidate: 'candidate:5', sdpMid: '1' },
      });
      s.fireEvent({
        type: 'candidate',
        candidate: { candidate: 'candidate:6', sdpMid: '' },
      });

      expect(s.pc.addIceCandidate).toHaveBeenNthCalledWith(1, {
        candidate: 'candidate:2',
        sdpMid: '0',
        sdpMLineIndex: 0,
      });
      expect(s.pc.addIceCandidate).toHaveBeenNthCalledWith(2, {
        candidate: 'candidate:3',
        sdpMid: '0',
      });
      expect(s.pc.addIceCandidate).toHaveBeenNthCalledWith(3, {
        candidate: 'candidate:4',
        sdpMid: null,
        sdpMLineIndex: 1,
      });
      expect(s.pc.addIceCandidate).toHaveBeenNthCalledWith(4, {
        candidate: 'candidate:5',
        sdpMid: '1',
        sdpMLineIndex: null,
      });
      expect(s.pc.addIceCandidate).toHaveBeenNthCalledWith(5, {
        candidate: 'candidate:6',
        sdpMid: '0',
      });

      s.pc.fireConnectionStateChange('connected');
      await started;
    });

    it('should carry on when a candidate of the camera cannot be added', async () => {
      const s = setup();
      s.pc.addIceCandidate.mockRejectedValue(new Error('bad candidate'));
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.fireEvent({ type: 'candidate', candidate: { candidate: 'candidate:2' } });
      await flushPromises();

      s.pc.fireConnectionStateChange('connected');
      await expect(started).resolves.toBeUndefined();
    });

    it('should ignore candidates once stopped', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await negotiate(s);
      s.backchannel.stop();
      await expect(started).rejects.toBeInstanceOf(BackchannelAbandonedError);

      s.pc.fireIceCandidate('candidate:late');
      expect(candidateCalls(s.hass)).toHaveLength(0);
    });
  });

  describe('events', () => {
    it('should ignore events it does not know', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.fireEvent({ type: 'other' });
      await connect(s);

      await expect(started).resolves.toBeUndefined();
    });

    it('should ignore events once stopped', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await flushPromises();
      s.backchannel.stop();
      await expect(started).rejects.toBeInstanceOf(BackchannelAbandonedError);

      s.fireEvent({ type: 'answer', answer: 'v=0' });
      expect(s.pc.setRemoteDescription).not.toHaveBeenCalled();
    });

    it('should report an error from Home Assistant during the call', async () => {
      const errorCallback = vi.fn();
      const s = setup({ errorCallback });
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      s.fireEvent({ type: 'error', code: 'webrtc_offer_failed', message: 'gone' });
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'failed', description: 'gone' }),
      );
      expect(s.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('during the call', () => {
    it('should report a connection that fails', async () => {
      const errorCallback = vi.fn();
      const s = setup({ errorCallback });
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      s.pc.fireConnectionStateChange('failed');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'failed' }),
      );
    });

    it('should report a microphone that ends', async () => {
      const errorCallback = vi.fn();
      const s = setup({ errorCallback });
      const stream = createStream();
      const started = s.backchannel.start(stream.asMediaStream());
      await connect(s);
      await started;

      stream.getAudioTracks()[0].dispatchEvent(new Event('ended'));
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'no_microphone' }),
      );
    });

    it('should ignore connection changes once stopped', async () => {
      const errorCallback = vi.fn();
      const s = setup({ errorCallback });
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      s.backchannel.stop();
      s.pc.fireConnectionStateChange('failed');
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('setStream', () => {
    it('should swap the microphone track', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      const next = createStream();
      await s.backchannel.setStream(next.asMediaStream());
      expect(s.pc.transceivers[0].sender.replaceTrack).toHaveBeenCalledWith(
        next.getAudioTracks()[0],
      );
    });

    it('should not watch a track swapped in as the call ends', async () => {
      const errorCallback = vi.fn();
      const s = setup({ errorCallback });
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      let release: () => void = () => {};
      s.pc.transceivers[0].sender.replaceTrack.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      const next = createStream();
      const swapped = s.backchannel.setStream(next.asMediaStream());
      s.backchannel.stop();
      release();
      await swapped;

      next.getAudioTracks()[0].dispatchEvent(new Event('ended'));
      expect(errorCallback).not.toHaveBeenCalled();
    });

    it('should do nothing without a call', async () => {
      const s = setup();
      await expect(
        s.backchannel.setStream(createStream().asMediaStream()),
      ).resolves.toBeUndefined();
    });

    it('should refuse a stream without a live audio track', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      const ended = new FakeMediaStreamTrack('audio');
      ended.readyState = 'ended';
      await expect(
        s.backchannel.setStream(new FakeMediaStream([ended]).asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
      await expect(
        s.backchannel.setStream(new FakeMediaStream().asMediaStream()),
      ).rejects.toMatchObject({ reason: 'no_microphone' });
    });
  });

  describe('stop', () => {
    it('should end the session and close the connection', async () => {
      const s = setup();
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      s.backchannel.stop();
      expect(s.unsubscribe).toHaveBeenCalled();
      expect(s.pc.close).toHaveBeenCalled();
    });

    it('should not fail when the session cannot be ended', async () => {
      const s = setup();
      s.unsubscribe.mockRejectedValue(new Error('connection lost'));
      const started = s.backchannel.start(createStream().asMediaStream());
      await connect(s);
      await started;

      expect(() => s.backchannel.stop()).not.toThrow();
      await flushPromises();
    });

    it('should do nothing when nothing was started', () => {
      const s = setup();
      expect(() => s.backchannel.stop()).not.toThrow();
    });
  });
});
