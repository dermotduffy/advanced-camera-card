import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { Go2RTCSessionController } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/session-controller';
import type { CreateWebRTCSourceOptions } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/factory';
import type { WebRTCStreamSource } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/webrtc';
import type {
  StreamProfile,
  StreamSource,
  StreamSourceContext,
} from '../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { GO2RTC_MODES } from '../../../../../src/config/schema/cameras';
import type { CardWideConfig } from '../../../../../src/config/schema/types';
import type { MediaPlayerController } from '../../../../../src/types';
import {
  FakeMediaStream,
  FakeMediaStreamTrack,
  FakeRTCPeerConnection,
  FakeWebSocket,
} from './test-utils';

const H264_PROFILE: StreamProfile = {
  hasVideo: true,
  hasH265Video: false,
  hasAudio: true,
  hasAACAudio: true,
};

const H265_PROFILE: StreamProfile = {
  hasVideo: true,
  hasH265Video: true,
  hasAudio: true,
  hasAACAudio: true,
};

const VIDEO_ONLY_PROFILE: StreamProfile = {
  hasVideo: true,
  hasH265Video: false,
  hasAudio: false,
  hasAACAudio: false,
};

// @vitest-environment jsdom
describe('Go2RTCSessionController', () => {
  const setup = (options?: {
    controls?: boolean;
    mediaPlayerController?: MediaPlayerController | null;
    binaryProfile?: StreamProfile;
    webRTCProfile?: StreamProfile;
    webRTCPeerConnection?: FakeRTCPeerConnection | null;
    createBinarySourceReturnsNull?: boolean;
    cardWideConfig?: CardWideConfig | null;
  }) => {
    const websockets: FakeWebSocket[] = [];
    const createWebSocket = vi.fn<[string], WebSocket>(() => {
      const websocket = new FakeWebSocket();
      websockets.push(websocket);
      return websocket.asWebSocket();
    });

    const binarySources: MockProxy<StreamSource>[] = [];
    const binaryContexts: StreamSourceContext[] = [];

    const createBinarySource = vi.fn((_mode, context: StreamSourceContext) => {
      binaryContexts.push(context);
      if (options?.createBinarySourceReturnsNull) {
        return null;
      }
      const source = mock<StreamSource>();
      source.getStreamProfile.mockReturnValue(options?.binaryProfile ?? H264_PROFILE);
      source.getCapabilities.mockReturnValue({
        supportsPause: true,
        hasAudio: true,
        has2WayAudio: false,
      });
      source.getTechnology.mockReturnValue(['mse']);
      binarySources.push(source);
      return source;
    });

    const webRTCStream = new FakeMediaStream([new FakeMediaStreamTrack('video')]);
    const webRTCSources: MockProxy<WebRTCStreamSource>[] = [];
    const webRTCContexts: StreamSourceContext[] = [];
    const webRTCOptions: (CreateWebRTCSourceOptions | undefined)[] = [];

    const createWebRTCSource = vi.fn(
      (context: StreamSourceContext, sourceOptions?: CreateWebRTCSourceOptions) => {
        webRTCContexts.push(context);
        webRTCOptions.push(sourceOptions);

        const source = mock<WebRTCStreamSource>();
        source.getStreamProfile.mockReturnValue(options?.webRTCProfile ?? H265_PROFILE);
        source.getCapabilities.mockReturnValue({
          supportsPause: true,
          hasAudio: true,
          has2WayAudio: false,
        });
        source.getTechnology.mockReturnValue(['webrtc']);
        source.getMediaStream.mockReturnValue(webRTCStream.asMediaStream());
        source.getPeerConnection.mockReturnValue(
          options?.webRTCPeerConnection?.asPeerConnection() ?? null,
        );
        source.setMicrophoneStream.mockResolvedValue(undefined);

        webRTCSources.push(source);
        return source;
      },
    );

    const offscreenVideos: HTMLVideoElement[] = [];
    const createVideoElement = vi.fn(() => {
      const offscreen = document.createElement('video');
      offscreenVideos.push(offscreen);
      return offscreen;
    });

    const mediaPlayerController =
      options?.mediaPlayerController === undefined
        ? mock<MediaPlayerController>()
        : options.mediaPlayerController;

    const getControls = vi.fn(() => options?.controls ?? false);
    const mediaLoadedCallback = vi.fn();
    const errorCallback = vi.fn();

    const session = new Go2RTCSessionController(
      {
        getControls,
        getMediaPlayerController: () => mediaPlayerController,
        getCardWideConfig: () => options?.cardWideConfig ?? null,
        mediaLoadedCallback,
        errorCallback,
      },
      { createWebSocket, createBinarySource, createWebRTCSource, createVideoElement },
    );

    const video = document.createElement('video');

    return {
      binaryContexts,
      binarySources,
      createVideoElement,
      createBinarySource,
      createWebRTCSource,
      createWebSocket,
      errorCallback,
      mediaLoadedCallback,
      offscreenVideos,
      session,
      video,
      webRTCContexts,
      webRTCOptions,
      webRTCSources,
      webRTCStream,
      websockets,
    };
  };

  type SetupResult = ReturnType<typeof setup>;

  const startSourceRace = (setupResult: SetupResult): void => {
    setupResult.session.connect('http://host/api/ws?src=camera', setupResult.video, [
      'mse',
      'webrtc',
    ]);
    setupResult.websockets[0].fireOpen();
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('connection', () => {
    it('should connect to the websocket form of the URL', () => {
      const { session, createWebSocket, video } = setup();
      session.connect('https://host/api/ws?src=camera', video, ['mse']);

      expect(createWebSocket).toBeCalledWith('wss://host/api/ws?src=camera');
    });

    it('should be idempotent for an unchanged target', () => {
      const { session, createWebSocket, video } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      session.connect('http://host/api/ws?src=camera', video, ['mse']);

      expect(createWebSocket).toBeCalledTimes(1);
    });

    it('should reconnect when the URL changes', () => {
      const { session, createWebSocket, video, websockets } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      session.connect('http://host/api/ws?src=other', video, ['mse']);

      expect(websockets[0].close).toBeCalled();
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should reconnect when the modes change', () => {
      const { session, createWebSocket, video, websockets } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);

      expect(websockets[0].close).toBeCalled();
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should be idempotent when omitted modes match the default', () => {
      const { session, createWebSocket, video } = setup();
      session.connect('http://host/api/ws?src=camera', video);
      session.connect('http://host/api/ws?src=camera', video, [...GO2RTC_MODES]);

      expect(createWebSocket).toBeCalledTimes(1);
    });

    it('should construct real collaborators by default', () => {
      const session = new Go2RTCSessionController({
        getControls: () => false,
        getMediaPlayerController: () => null,
        getCardWideConfig: () => null,
        mediaLoadedCallback: vi.fn(),
        errorCallback: vi.fn(),
      });
      session.connect('ws://localhost:1/api/ws', document.createElement('video'), [
        'mse',
      ]);
      session.reset();
    });

    it('should default to all modes when none are configured', () => {
      const { session, video, websockets, createBinarySource, createWebRTCSource } =
        setup();
      session.connect('http://host/api/ws?src=camera', video);
      websockets[0].fireOpen();

      expect(createBinarySource).toBeCalledTimes(1);
      expect(createWebRTCSource).toBeCalledTimes(1);
    });

    it('should keep the channel open when the binary lane drains synchronously while WebRTC is configured', () => {
      // The binary factory declines every mode, draining the queue during the
      // open handler; because WebRTC is started first, the lanes-dead check
      // sees a live lane and must not close the still-open channel or
      // reconnect.
      const { session, video, websockets, createWebRTCSource, createWebSocket } = setup({
        createBinarySourceReturnsNull: true,
      });
      session.connect('http://host/api/ws?src=camera', video, ['mse', 'webrtc']);
      websockets[0].fireOpen();

      expect(createWebRTCSource).toBeCalledTimes(1);
      expect(websockets[0].close).not.toBeCalled();

      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(1);
    });
  });

  describe('binary lane', () => {
    it('should start an MSE source once open', () => {
      const { session, video, websockets, createBinarySource, binarySources } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();

      expect(createBinarySource).toBeCalledTimes(1);
      expect(createBinarySource.mock.calls[0][0]).toBe('mse');
      expect(binarySources[0].start).toBeCalled();
    });

    it('should report loaded media from the binary source', () => {
      const { session, video, websockets, binaryContexts, mediaLoadedCallback } =
        setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).toBeCalledWith(
        expect.objectContaining({ technology: ['mse'] }),
      );
    });

    it('should reconnect when the only binary source fails', () => {
      const {
        session,
        video,
        websockets,
        binaryContexts,
        binarySources,
        createWebSocket,
      } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.failedCallback('media_error');

      expect(binarySources[0].stop).toBeCalled();
      expect(websockets[0].close).toBeCalled();

      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should fall back through the binary modes in order', () => {
      const {
        session,
        video,
        websockets,
        binaryContexts,
        createBinarySource,
        createWebSocket,
      } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse', 'mp4', 'mjpeg']);
      websockets[0].fireOpen();

      expect(createBinarySource.mock.calls[0][0]).toBe('mse');
      binaryContexts[0].callbacks.failedCallback('media_error');
      expect(createBinarySource.mock.calls[1][0]).toBe('mp4');
      binaryContexts[1].callbacks.failedCallback('media_error');
      expect(createBinarySource.mock.calls[2][0]).toBe('mjpeg');

      // The last binary mode failing reconnects.
      binaryContexts[2].callbacks.failedCallback('media_error');
      expect(websockets[0].close).toBeCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should reconnect when the factory declines the mode', () => {
      const { session, video, websockets, createWebSocket } = setup({
        createBinarySourceReturnsNull: true,
      });
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();

      expect(websockets[0].close).toBeCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should include the media player controller in loaded media', () => {
      const setupResult = setup();
      setupResult.session.connect('http://host/api/ws?src=camera', setupResult.video, [
        'mse',
      ]);
      setupResult.websockets[0].fireOpen();
      setupResult.binaryContexts[0].callbacks.loadedCallback();

      expect(
        setupResult.mediaLoadedCallback.mock.calls[0][0].mediaPlayerController,
      ).toBeDefined();
    });

    it('should omit an absent media player controller', () => {
      const setupResult = setup({ mediaPlayerController: null });
      setupResult.session.connect('http://host/api/ws?src=camera', setupResult.video, [
        'mse',
      ]);
      setupResult.websockets[0].fireOpen();
      setupResult.binaryContexts[0].callbacks.loadedCallback();

      expect(
        'mediaPlayerController' in setupResult.mediaLoadedCallback.mock.calls[0][0],
      ).toBe(false);
    });

    it('should hide controls temporarily on load', () => {
      const { session, video, websockets, binaryContexts } = setup({ controls: true });
      video.controls = true;
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(video.controls).toBe(false);
      vi.advanceTimersByTime(2 * 1000);
      expect(video.controls).toBe(true);
    });
  });

  describe('webrtc as only source', () => {
    it('should attach WebRTC directly to the real video with no off-screen video', () => {
      const { session, video, websockets, createVideoElement, webRTCContexts } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();

      expect(createVideoElement).not.toBeCalled();
      expect(webRTCContexts[0].video).toBe(video);
    });

    it('should report loaded media and close the socket on commit', () => {
      const { session, video, websockets, webRTCContexts, mediaLoadedCallback } =
        setup();
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).toBeCalledWith(
        expect.objectContaining({ technology: ['webrtc'] }),
      );
      expect(websockets[0].close).toBeCalled();
    });

    it('should reconnect when the committed WebRTC stream fails', () => {
      const { session, video, websockets, webRTCContexts, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();
      webRTCContexts[0].callbacks.failedCallback('media_error');

      expect(video.srcObject).toBeNull();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should pre-arm the WebRTC source with the current microphone stream', () => {
      const { session, video, websockets, webRTCOptions } = setup();
      const micStream = new FakeMediaStream([
        new FakeMediaStreamTrack('audio'),
      ]).asMediaStream();
      session.setMicrophoneStream(micStream);
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();

      expect(webRTCOptions[0]?.microphoneStream).toBe(micStream);
    });

    it('should re-dispatch loaded media on an audio mute transition', () => {
      const peerConnection = new FakeRTCPeerConnection();
      const audioTransceiver = peerConnection.addTransceiver('audio', {
        direction: 'recvonly',
      });
      const { session, video, websockets, webRTCContexts, mediaLoadedCallback } = setup({
        webRTCPeerConnection: peerConnection,
      });
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();
      mediaLoadedCallback.mockClear();

      audioTransceiver.receiver.track.setMuted(true);

      expect(mediaLoadedCallback).toBeCalledTimes(1);
    });
  });

  describe('race arbitration', () => {
    it('should start both a binary and an off-screen WebRTC lane', () => {
      const setupResult = setup();
      startSourceRace(setupResult);

      expect(setupResult.createBinarySource).toBeCalledTimes(1);
      expect(setupResult.createVideoElement).toBeCalledTimes(1);
      expect(setupResult.webRTCContexts[0].video).toBe(setupResult.offscreenVideos[0]);
    });

    it('should adopt the WebRTC stream when it scores higher', () => {
      const setupResult = setup({
        binaryProfile: H264_PROFILE,
        webRTCProfile: H265_PROFILE,
      });
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.loadedCallback();
      setupResult.mediaLoadedCallback.mockClear();
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.video.srcObject).toBe(setupResult.webRTCStream.asMediaStream());
      expect(setupResult.binarySources[0].stop).toBeCalled();
      expect(setupResult.websockets[0].close).toBeCalled();
      expect(setupResult.mediaLoadedCallback).toBeCalledWith(
        expect.objectContaining({ technology: ['webrtc'] }),
      );
    });

    it('should keep the binary stream when it scores higher', () => {
      const setupResult = setup({
        binaryProfile: H265_PROFILE,
        webRTCProfile: VIDEO_ONLY_PROFILE,
      });
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.loadedCallback();
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.webRTCSources[0].stop).toBeCalled();
      expect(setupResult.binarySources[0].stop).not.toBeCalled();
      expect(setupResult.websockets[0].close).not.toBeCalled();
    });

    it('should adopt WebRTC that wins before the binary source loads', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.video.srcObject).toBe(setupResult.webRTCStream.asMediaStream());
      expect(setupResult.binarySources[0].stop).toBeCalled();
    });

    it('should not reconnect when a racing binary fails while WebRTC continues', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');

      expect(setupResult.websockets[0].close).not.toBeCalled();
    });

    it('should not reconnect when a racing WebRTC fails while binary continues', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.failedCallback('connect_timeout');

      expect(setupResult.webRTCSources[0].stop).toBeCalled();
      expect(setupResult.websockets[0].close).not.toBeCalled();
    });

    it('should reconnect when both racing lanes fail', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');
      setupResult.webRTCContexts[0].callbacks.failedCallback('connect_timeout');

      expect(setupResult.websockets[0].close).toBeCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(setupResult.createWebSocket).toBeCalledTimes(2);
    });

    it('should ignore a duplicate loaded callback from a lost WebRTC lane', () => {
      const setupResult = setup({
        binaryProfile: H265_PROFILE,
        webRTCProfile: VIDEO_ONLY_PROFILE,
      });
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      // WebRTC lost and stopped; a late duplicate callback is ignored.
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.webRTCSources[0].stop).toBeCalledTimes(1);
    });
  });

  describe('microphone', () => {
    it('should forward a microphone change to the WebRTC source', () => {
      const { session, video, websockets, webRTCSources } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();
      const micStream = new FakeMediaStream([
        new FakeMediaStreamTrack('audio'),
      ]).asMediaStream();
      session.setMicrophoneStream(micStream);

      expect(webRTCSources[0].setMicrophoneStream).toBeCalledWith(micStream);
    });

    it('should tolerate a microphone change with no WebRTC source', () => {
      const { session } = setup();

      expect(() => session.setMicrophoneStream(null)).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('should stop the source and reconnect on unexpected closure', () => {
      const { session, video, websockets, binarySources, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();
      websockets[0].fireClose();

      expect(binarySources[0].stop).toBeCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should escalate via the error callback after exhausting reconnect attempts', () => {
      const { session, video, websockets, createWebSocket, errorCallback } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);

      // Each fresh connection closes before loading, consuming one reconnect
      // attempt; after the bounded budget the session escalates instead of
      // looping forever.
      for (let attempt = 0; attempt < 3; attempt++) {
        websockets[attempt].fireOpen();
        websockets[attempt].fireClose();
        vi.advanceTimersByTime(2 * 1000);
      }
      websockets[3].fireOpen();
      websockets[3].fireClose();

      expect(createWebSocket).toBeCalledTimes(4);
      expect(errorCallback).toBeCalledTimes(1);

      // The socket dropped with no source reporting a cause.
      expect(errorCallback).toBeCalledWith(null);
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(4);
    });

    it('should escalate with the most recent source failure reason', () => {
      const { session, video, websockets, binaryContexts, errorCallback } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);

      // Each attempt: the single binary source fails, which drains the mode
      // queue and reconnects; after the budget the session escalates carrying
      // that last failure's reason.
      for (let attempt = 0; attempt < 3; attempt++) {
        websockets[attempt].fireOpen();
        binaryContexts[attempt].callbacks.failedCallback('unsupported');
        vi.advanceTimersByTime(2 * 1000);
      }
      websockets[3].fireOpen();
      binaryContexts[3].callbacks.failedCallback('unsupported');

      expect(errorCallback).toBeCalledWith('unsupported');
    });

    it('should reset the reconnect budget after a successful media load', () => {
      const {
        session,
        video,
        websockets,
        binaryContexts,
        createWebSocket,
        errorCallback,
      } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);

      // Exhaust two of the three attempts.
      for (let attempt = 0; attempt < 2; attempt++) {
        websockets[attempt].fireOpen();
        websockets[attempt].fireClose();
        vi.advanceTimersByTime(2 * 1000);
      }

      // A successful load restores the full reconnect budget.
      websockets[2].fireOpen();
      binaryContexts[binaryContexts.length - 1].callbacks.loadedCallback();

      // Three further failures are absorbed before escalation.
      for (let attempt = 2; attempt < 5; attempt++) {
        websockets[attempt].fireClose();
        vi.advanceTimersByTime(2 * 1000);
        websockets[attempt + 1].fireOpen();
      }

      expect(errorCallback).not.toBeCalled();
      expect(createWebSocket).toBeCalledTimes(6);
    });

    it('should tear down all lanes and clear the video on reset', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.session.reset();

      expect(setupResult.binarySources[0].stop).toBeCalled();
      expect(setupResult.webRTCSources[0].stop).toBeCalled();
      expect(setupResult.websockets[0].close).toBeCalled();
      expect(setupResult.video.srcObject).toBeNull();
    });

    it('should not reconnect after reset', () => {
      const { session, video, websockets, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();
      websockets[0].fireClose();
      session.reset();
      vi.advanceTimersByTime(2 * 1000);

      expect(createWebSocket).toBeCalledTimes(1);
    });

    it('should allow connecting to the same target after reset', () => {
      const { session, video, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      session.reset();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);

      expect(createWebSocket).toBeCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should reconnect when a committed binary source later fails', () => {
      const { session, video, websockets, binaryContexts, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();
      binaryContexts[0].callbacks.failedCallback('media_error');

      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toBeCalledTimes(2);
    });

    it('should ignore a loaded callback from a retired binary source', () => {
      const setupResult = setup();
      startSourceRace(setupResult);

      // WebRTC wins and stops the binary lane.
      setupResult.webRTCContexts[0].callbacks.loadedCallback();
      setupResult.mediaLoadedCallback.mockClear();
      setupResult.binaryContexts[0].callbacks.loadedCallback();

      expect(setupResult.mediaLoadedCallback).not.toBeCalled();
    });

    it('should ignore a failed callback from a retired binary source', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.loadedCallback();
      setupResult.binarySources[0].stop.mockClear();
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');

      expect(setupResult.binarySources[0].stop).not.toBeCalled();
    });

    it('should ignore a failed callback from a retired WebRTC source', () => {
      const { session, video, websockets, webRTCContexts, webRTCSources } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();
      webRTCContexts[0].callbacks.failedCallback('media_error');
      webRTCSources[0].stop.mockClear();
      webRTCContexts[0].callbacks.failedCallback('media_error');

      expect(webRTCSources[0].stop).not.toBeCalled();
    });

    it('should adopt WebRTC when the racing binary already failed', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.video.srcObject).toBe(setupResult.webRTCStream.asMediaStream());
    });

    it('should commit WebRTC even when it exposes no media stream', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCSources[0].getMediaStream.mockReturnValue(null);
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.video.srcObject).toBeFalsy();
      expect(setupResult.binarySources[0].stop).toBeCalled();
    });

    it('should not report media that cannot be described', () => {
      const { session, websockets, binaryContexts, mediaLoadedCallback } = setup();
      const notAVideo = document.createElement('div');
      session.connect(
        'http://host/api/ws?src=camera',
        notAVideo as unknown as HTMLVideoElement,
        ['mse'],
      );
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).not.toBeCalled();
    });

    it('should swallow a rejected microphone update', async () => {
      const { session, video, websockets, webRTCSources } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();
      webRTCSources[0].setMicrophoneStream.mockRejectedValue(new Error('replace'));

      expect(() => session.setMicrophoneStream(null)).not.toThrow();
      await Promise.resolve();
    });

    it('should ignore callbacks fired while a binary source is constructed', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<[string], WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const mediaLoadedCallback = vi.fn();
      const createBinarySource = vi.fn((_mode, context: StreamSourceContext) => {
        context.callbacks.loadedCallback();
        context.callbacks.failedCallback('media_error');
        return null;
      });

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          getMediaPlayerController: () => null,
          getCardWideConfig: () => null,
          mediaLoadedCallback,
          errorCallback: vi.fn(),
        },
        { createWebSocket, createBinarySource },
      );
      session.connect('http://host/api/ws?src=camera', document.createElement('video'), [
        'mse',
      ]);
      websockets[0].fireOpen();

      expect(mediaLoadedCallback).not.toBeCalled();
    });

    it('should ignore callbacks fired while a WebRTC source is constructed', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<[string], WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });
      const mediaLoadedCallback = vi.fn();
      const createWebRTCSource = vi.fn((context: StreamSourceContext) => {
        context.callbacks.loadedCallback();
        context.callbacks.failedCallback('media_error');
        return mock<WebRTCStreamSource>();
      });

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          getMediaPlayerController: () => null,
          getCardWideConfig: () => null,
          mediaLoadedCallback,
          errorCallback: vi.fn(),
        },
        { createWebSocket, createWebRTCSource },
      );
      session.connect('http://host/api/ws?src=camera', document.createElement('video'), [
        'webrtc',
      ]);
      websockets[0].fireOpen();

      expect(mediaLoadedCallback).not.toBeCalled();
    });

    it('should use the default binary source factory when none is injected', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<[string], WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          getMediaPlayerController: () => null,
          getCardWideConfig: () => null,
          mediaLoadedCallback: vi.fn(),
          errorCallback: vi.fn(),
        },
        { createWebSocket },
      );
      session.connect('http://host/api/ws?src=camera', document.createElement('video'), [
        'mse',
      ]);

      // The real MSE source reports itself unsupported on jsdom, so the session
      // closes and retries; the point is that the default factory was used.
      websockets[0].fireOpen();

      expect(websockets[0].close).toBeCalled();
      session.reset();
    });

    it('should use the default WebRTC source factory when none is injected', () => {
      vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection);
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<[string], WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          getMediaPlayerController: () => null,
          getCardWideConfig: () => null,
          mediaLoadedCallback: vi.fn(),
          errorCallback: vi.fn(),
        },
        { createWebSocket },
      );
      session.connect('http://host/api/ws?src=camera', document.createElement('video'), [
        'webrtc',
      ]);

      expect(() => websockets[0].fireOpen()).not.toThrow();
      session.reset();
      vi.unstubAllGlobals();
    });

    it('should create an off-screen video with the default factory when none is injected', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<[string], WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const webRTCContexts: StreamSourceContext[] = [];
      const createWebRTCSource = vi.fn((context: StreamSourceContext) => {
        webRTCContexts.push(context);
        return mock<WebRTCStreamSource>();
      });

      const createBinarySource = vi.fn((): StreamSource => mock<StreamSource>());
      const video = document.createElement('video');

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          getMediaPlayerController: () => null,
          getCardWideConfig: () => null,
          mediaLoadedCallback: vi.fn(),
          errorCallback: vi.fn(),
        },
        { createWebSocket, createBinarySource, createWebRTCSource },
      );
      session.connect('http://host/api/ws?src=camera', video, ['mse', 'webrtc']);
      websockets[0].fireOpen();

      // The off-screen video is a real element, not the connected one.
      expect(webRTCContexts[0].video).toBeInstanceOf(HTMLVideoElement);
      expect(webRTCContexts[0].video).not.toBe(video);
    });
  });

  describe('source failure logging', () => {
    it('should log the failing binary mode and reason when debug logging is on', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);
      const { session, video, websockets, binaryContexts } = setup({
        cardWideConfig: { debug: { logging: true } },
      });
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();

      binaryContexts[0].callbacks.failedCallback('media_error');

      expect(consoleSpy).toBeCalledWith('go2rtc-experimental source failed', {
        lane: 'binary',
        mode: 'mse',
        reason: 'media_error',
      });
    });

    it('should log the webrtc lane and reason without a mode', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);
      const { session, video, websockets, webRTCContexts } = setup({
        cardWideConfig: { debug: { logging: true } },
      });
      session.connect('http://host/api/ws?src=camera', video, ['webrtc']);
      websockets[0].fireOpen();

      webRTCContexts[0].callbacks.failedCallback('connect_timeout');

      expect(consoleSpy).toBeCalledWith('go2rtc-experimental source failed', {
        lane: 'webrtc',
        reason: 'connect_timeout',
      });
    });

    it('should not log when debug logging is off', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);
      const { session, video, websockets, binaryContexts } = setup();
      session.connect('http://host/api/ws?src=camera', video, ['mse']);
      websockets[0].fireOpen();

      binaryContexts[0].callbacks.failedCallback('media_error');

      expect(consoleSpy).not.toBeCalled();
    });
  });
});
