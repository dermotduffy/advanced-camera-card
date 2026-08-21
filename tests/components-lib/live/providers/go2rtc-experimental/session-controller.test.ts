import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import {
  Go2RTCSessionController,
  type SessionSurfaces,
} from '../../../../../src/components-lib/live/providers/go2rtc-experimental/session-controller';
import type {
  BinarySource,
  BinaryStreamTargets,
  CreateWebRTCSourceOptions,
} from '../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/factory';
import type { WebRTCStreamSource } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/webrtc';
import type {
  StreamProfile,
  StreamSource,
  StreamSourceCallbacks,
  StreamSourceContext,
  VideoStreamTarget,
} from '../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { GO2RTC_MODES, type Go2RTCMode } from '../../../../../src/config/schema/cameras';
import type { CardWideConfig } from '../../../../../src/config/schema/types';
import type { MediaPlayerController } from '../../../../../src/types';
import {
  FakeMediaStream,
  FakeMediaStreamTrack,
  FakeRTCPeerConnection,
  FakeWebSocket,
} from '../../../../go2rtc/test-utils';

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
  // The pair of render surfaces the component hands the session. Each surface
  // carries its own media-player controller.
  const createSurfaces = (videoElement?: HTMLVideoElement) => {
    const video = videoElement ?? document.createElement('video');
    const videoController = mock<MediaPlayerController>();

    const imageController = mock<MediaPlayerController>();
    const image = document.createElement('img');
    const showFrame = vi.fn();
    const reset = vi.fn();

    // The element the video surface currently resolves to; a test can null it
    // to simulate the component detaching the surface mid-stream.
    let currentVideo: HTMLVideoElement | null = video;
    const setVideoElement = (element: HTMLVideoElement | null): void => {
      currentVideo = element;
    };

    const surfaces: SessionSurfaces = {
      video: { getElement: () => currentVideo, getMediaPlayer: () => videoController },
      image: {
        getElement: () => image,
        showFrame,
        reset,
        getMediaPlayer: () => imageController,
      },
    };

    return {
      surfaces,
      video,
      image,
      videoController,
      imageController,
      showFrame,
      reset,
      setVideoElement,
    };
  };

  const setup = (options?: {
    controls?: boolean;
    binaryProfile?: StreamProfile;
    webRTCProfile?: StreamProfile;
    webRTCPeerConnection?: FakeRTCPeerConnection | null;
    createBinarySourceReturnsNull?: boolean;
    cardWideConfig?: CardWideConfig | null;
  }) => {
    const websockets: FakeWebSocket[] = [];
    const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
      const websocket = new FakeWebSocket();
      websockets.push(websocket);
      return websocket.asWebSocket();
    });

    const binarySources: MockProxy<StreamSource>[] = [];
    const binaryContexts: {
      callbacks: StreamSourceCallbacks;
      targets: BinaryStreamTargets;
    }[] = [];

    const createBinarySource = vi.fn(
      (
        mode: Go2RTCMode,
        targets: BinaryStreamTargets,
        _channel,
        callbacks: StreamSourceCallbacks,
      ): BinarySource | null => {
        binaryContexts.push({ callbacks, targets });
        if (options?.createBinarySourceReturnsNull) {
          return null;
        }
        const source = mock<StreamSource>();
        source.getStreamProfile.mockReturnValue(options?.binaryProfile ?? H264_PROFILE);
        source.getCapabilities.mockReturnValue({
          supportsPause: true,
          hasAudio: true,
        });
        source.getTechnology.mockReturnValue([mode]);
        binarySources.push(source);
        return { source, surface: mode === 'mse' ? 'video' : 'image' };
      },
    );

    const webRTCStream = new FakeMediaStream([new FakeMediaStreamTrack('video')]);
    const webRTCSources: MockProxy<WebRTCStreamSource>[] = [];
    const webRTCContexts: StreamSourceContext<VideoStreamTarget>[] = [];
    const webRTCOptions: (CreateWebRTCSourceOptions | undefined)[] = [];

    const createWebRTCSource = vi.fn(
      (
        context: StreamSourceContext<VideoStreamTarget>,
        sourceOptions?: CreateWebRTCSourceOptions,
      ) => {
        webRTCContexts.push(context);
        webRTCOptions.push(sourceOptions);

        const source = mock<WebRTCStreamSource>();
        source.getStreamProfile.mockReturnValue(options?.webRTCProfile ?? H265_PROFILE);
        source.getCapabilities.mockReturnValue({
          supportsPause: true,
          hasAudio: true,
        });
        source.getTechnology.mockReturnValue(['webrtc']);
        source.getMediaStream.mockReturnValue(webRTCStream.asMediaStream());
        source.getPeerConnection.mockReturnValue(
          options?.webRTCPeerConnection?.asPeerConnection() ?? null,
        );
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

    const getControls = vi.fn(() => options?.controls ?? false);
    const mediaLoadedCallback = vi.fn();
    const surfaceCommittedCallback = vi.fn();
    const streamErrorCallback = vi.fn();

    const session = new Go2RTCSessionController(
      {
        getControls,
        getCardWideConfig: () => options?.cardWideConfig ?? null,
        mediaLoadedCallback,
        surfaceCommittedCallback,
        streamErrorCallback,
      },
      { createWebSocket, createBinarySource, createWebRTCSource, createVideoElement },
    );

    const surfaceRefs = createSurfaces();

    return {
      ...surfaceRefs,
      binaryContexts,
      binarySources,
      createVideoElement,
      createBinarySource,
      createWebRTCSource,
      createWebSocket,
      streamErrorCallback,
      mediaLoadedCallback,
      offscreenVideos,
      session,
      surfaceCommittedCallback,
      webRTCContexts,
      webRTCOptions,
      webRTCSources,
      webRTCStream,
      websockets,
    };
  };

  type SetupResult = ReturnType<typeof setup>;

  const startSourceRace = (setupResult: SetupResult): void => {
    setupResult.session.connect('http://host/api/ws?src=camera', setupResult.surfaces, [
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
      const { session, surfaces, createWebSocket } = setup();
      session.connect('https://host/api/ws?src=camera', surfaces, ['mse']);

      expect(createWebSocket).toHaveBeenCalledWith('wss://host/api/ws?src=camera');
    });

    it('should be idempotent for an unchanged target', () => {
      const { session, surfaces, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);

      expect(createWebSocket).toHaveBeenCalledTimes(1);
    });

    it('should reconnect when the URL changes', () => {
      const { session, surfaces, createWebSocket, websockets } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      session.connect('http://host/api/ws?src=other', surfaces, ['mse']);

      expect(websockets[0].close).toHaveBeenCalled();
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should reconnect when the modes change', () => {
      const { session, surfaces, createWebSocket, websockets } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);

      expect(websockets[0].close).toHaveBeenCalled();
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should be idempotent when omitted modes match the default', () => {
      const { session, surfaces, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces);
      session.connect('http://host/api/ws?src=camera', surfaces, [...GO2RTC_MODES]);

      expect(createWebSocket).toHaveBeenCalledTimes(1);
    });

    it('should construct real collaborators by default', () => {
      const session = new Go2RTCSessionController({
        getControls: () => false,
        surfaceCommittedCallback: vi.fn(),
        getCardWideConfig: () => null,
        mediaLoadedCallback: vi.fn(),
        streamErrorCallback: vi.fn(),
      });
      session.connect('ws://localhost:1/api/ws', createSurfaces().surfaces, ['mse']);
      session.reset();
    });

    it('should default to all modes when none are configured', () => {
      const { session, surfaces, websockets, createBinarySource, createWebRTCSource } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces);
      websockets[0].fireOpen();

      expect(createBinarySource).toHaveBeenCalledTimes(1);
      expect(createWebRTCSource).toHaveBeenCalledTimes(1);
    });

    it('should keep the channel open when the binary lane drains synchronously while WebRTC is configured', () => {
      // The binary factory declines every mode, draining the queue during the
      // open handler; because WebRTC is started first, the lanes-dead check
      // sees a live lane and must not close the still-open channel or
      // reconnect.
      const { session, surfaces, websockets, createWebRTCSource, createWebSocket } =
        setup({
          createBinarySourceReturnsNull: true,
        });
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse', 'webrtc']);
      websockets[0].fireOpen();

      expect(createWebRTCSource).toHaveBeenCalledTimes(1);
      expect(websockets[0].close).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('binary lane', () => {
    it('should start an MSE source once open', () => {
      const { session, surfaces, websockets, createBinarySource, binarySources } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();

      expect(createBinarySource).toHaveBeenCalledTimes(1);
      expect(createBinarySource.mock.calls[0][0]).toBe('mse');
      expect(binarySources[0].start).toHaveBeenCalled();
    });

    it('should report loaded media from the binary source', () => {
      const { session, surfaces, websockets, binaryContexts, mediaLoadedCallback } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).toHaveBeenCalledWith(
        expect.objectContaining({ technology: ['mse'] }),
      );
    });

    it('should reconnect when the only binary source fails', () => {
      const {
        session,
        surfaces,
        websockets,
        binaryContexts,
        binarySources,
        createWebSocket,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.failedCallback('media_error');

      expect(binarySources[0].stop).toHaveBeenCalled();
      expect(websockets[0].close).toHaveBeenCalled();

      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should fall back through the binary modes in order', () => {
      const {
        session,
        surfaces,
        websockets,
        binaryContexts,
        createBinarySource,
        createWebSocket,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, [
        'mse',
        'mp4',
        'mjpeg',
      ]);
      websockets[0].fireOpen();

      expect(createBinarySource.mock.calls[0][0]).toBe('mse');
      binaryContexts[0].callbacks.failedCallback('media_error');
      expect(createBinarySource.mock.calls[1][0]).toBe('mp4');
      binaryContexts[1].callbacks.failedCallback('media_error');
      expect(createBinarySource.mock.calls[2][0]).toBe('mjpeg');

      // The last binary mode failing reconnects.
      binaryContexts[2].callbacks.failedCallback('media_error');
      expect(websockets[0].close).toHaveBeenCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should reconnect when the factory declines the mode', () => {
      const { session, surfaces, websockets, createWebSocket } = setup({
        createBinarySourceReturnsNull: true,
      });
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();

      expect(websockets[0].close).toHaveBeenCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should report loaded media with the video surface controller for MSE', () => {
      const setupResult = setup();
      setupResult.session.connect(
        'http://host/api/ws?src=camera',
        setupResult.surfaces,
        ['mse'],
      );
      setupResult.websockets[0].fireOpen();
      setupResult.binaryContexts[0].callbacks.loadedCallback();

      expect(
        setupResult.mediaLoadedCallback.mock.calls[0][0].mediaPlayerController,
      ).toBe(setupResult.videoController);
      expect(setupResult.surfaceCommittedCallback).toHaveBeenCalledWith('video');
    });

    it('should report loaded media with the image surface controller for MJPEG', () => {
      const setupResult = setup();
      setupResult.session.connect(
        'http://host/api/ws?src=camera',
        setupResult.surfaces,
        ['mjpeg'],
      );
      setupResult.websockets[0].fireOpen();
      setupResult.binaryContexts[0].callbacks.loadedCallback();

      expect(
        setupResult.mediaLoadedCallback.mock.calls[0][0].mediaPlayerController,
      ).toBe(setupResult.imageController);
      expect(setupResult.surfaceCommittedCallback).toHaveBeenCalledWith('image');
    });

    it('should hide controls temporarily on load', () => {
      const { session, surfaces, video, websockets, binaryContexts } = setup({
        controls: true,
      });
      video.controls = true;
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(video.controls).toBe(false);
      vi.advanceTimersByTime(2 * 1000);
      expect(video.controls).toBe(true);
    });

    it('should refresh dimensions but not re-commit when the same source reloads', () => {
      const {
        session,
        surfaces,
        video,
        websockets,
        binaryContexts,
        mediaLoadedCallback,
        surfaceCommittedCallback,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();

      Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
      binaryContexts[0].callbacks.loadedCallback();

      // A mid-stream resolution change re-fires loadeddata with new dimensions.
      Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });
      binaryContexts[0].callbacks.loadedCallback();

      // Committed once, but the reload refreshed the reported dimensions.
      expect(surfaceCommittedCallback).toHaveBeenCalledTimes(1);
      expect(mediaLoadedCallback.mock.calls[0][0]).toEqual(
        expect.objectContaining({ width: 640, height: 480 }),
      );
      expect(mediaLoadedCallback.mock.calls[1][0]).toEqual(
        expect.objectContaining({ width: 1920, height: 1080 }),
      );
    });
  });

  describe('webrtc as only source', () => {
    it('should attach WebRTC directly to the real video with no off-screen video', () => {
      const {
        session,
        surfaces,
        video,
        websockets,
        createVideoElement,
        webRTCContexts,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();

      expect(createVideoElement).not.toHaveBeenCalled();
      expect(webRTCContexts[0].target.video).toBe(video);
    });

    it('should report loaded media and close the socket on commit', () => {
      const { session, surfaces, websockets, webRTCContexts, mediaLoadedCallback } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).toHaveBeenCalledWith(
        expect.objectContaining({ technology: ['webrtc'] }),
      );
      expect(websockets[0].close).toHaveBeenCalled();
    });

    it('should reconnect when the committed WebRTC stream fails', () => {
      const { session, surfaces, video, websockets, webRTCContexts, createWebSocket } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();
      webRTCContexts[0].callbacks.failedCallback('media_error');

      expect(video.srcObject).toBeNull();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should re-dispatch loaded media on an audio mute transition', () => {
      const peerConnection = new FakeRTCPeerConnection();
      const audioTransceiver = peerConnection.addTransceiver('audio', {
        direction: 'recvonly',
      });
      const { session, surfaces, websockets, webRTCContexts, mediaLoadedCallback } =
        setup({
          webRTCPeerConnection: peerConnection,
        });
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();
      mediaLoadedCallback.mockClear();

      audioTransceiver.receiver.track.setMuted(true);

      expect(mediaLoadedCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('race arbitration', () => {
    it('should start both a binary and an off-screen WebRTC lane', () => {
      const setupResult = setup();
      startSourceRace(setupResult);

      expect(setupResult.createBinarySource).toHaveBeenCalledTimes(1);
      expect(setupResult.createVideoElement).toHaveBeenCalledTimes(1);
      expect(setupResult.webRTCContexts[0].target.video).toBe(
        setupResult.offscreenVideos[0],
      );
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
      expect(setupResult.binarySources[0].stop).toHaveBeenCalled();
      expect(setupResult.websockets[0].close).toHaveBeenCalled();
      expect(setupResult.mediaLoadedCallback).toHaveBeenCalledWith(
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

      expect(setupResult.webRTCSources[0].stop).toHaveBeenCalled();
      expect(setupResult.binarySources[0].stop).not.toHaveBeenCalled();
      expect(setupResult.websockets[0].close).not.toHaveBeenCalled();
    });

    it('should adopt WebRTC that wins before the binary source loads', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.video.srcObject).toBe(setupResult.webRTCStream.asMediaStream());
      expect(setupResult.binarySources[0].stop).toHaveBeenCalled();
    });

    it('should not reconnect when a racing binary fails while WebRTC continues', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');

      expect(setupResult.websockets[0].close).not.toHaveBeenCalled();
    });

    it('should not reconnect when a racing WebRTC fails while binary continues', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.failedCallback('connect_timeout');

      expect(setupResult.webRTCSources[0].stop).toHaveBeenCalled();
      expect(setupResult.websockets[0].close).not.toHaveBeenCalled();
    });

    it('should reconnect when both racing lanes fail', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');
      setupResult.webRTCContexts[0].callbacks.failedCallback('connect_timeout');

      expect(setupResult.websockets[0].close).toHaveBeenCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(setupResult.createWebSocket).toHaveBeenCalledTimes(2);
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

      expect(setupResult.webRTCSources[0].stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('surfaces', () => {
    it('should feed image frames to the image surface', () => {
      const setupResult = setup();
      setupResult.session.connect(
        'http://host/api/ws?src=camera',
        setupResult.surfaces,
        ['mjpeg'],
      );
      setupResult.websockets[0].fireOpen();
      const frame = new Blob(['frame'], { type: 'image/jpeg' });

      setupResult.binaryContexts[0].targets.image.showFrame(frame);

      expect(setupResult.showFrame).toHaveBeenCalledWith(frame);
    });

    it('should reset the outgoing video surface when falling back to an image mode', () => {
      const { session, surfaces, video, websockets, binaryContexts, reset } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse', 'mjpeg']);
      websockets[0].fireOpen();

      // MSE commits on the video surface, then fails; MJPEG then commits on the
      // image surface, so the video surface is cleared on the switch.
      binaryContexts[0].callbacks.loadedCallback();
      video.srcObject = new FakeMediaStream().asMediaStream();
      binaryContexts[0].callbacks.failedCallback('media_error');
      binaryContexts[1].callbacks.loadedCallback();

      expect(video.srcObject).toBeNull();
      // The image surface, being committed to, is not reset.
      expect(reset).not.toHaveBeenCalled();
    });

    it('should reset the outgoing image surface when WebRTC wins over an image mode', () => {
      const setupResult = setup({
        binaryProfile: VIDEO_ONLY_PROFILE,
        webRTCProfile: H265_PROFILE,
      });
      setupResult.session.connect(
        'http://host/api/ws?src=camera',
        setupResult.surfaces,
        ['mjpeg', 'webrtc'],
      );
      setupResult.websockets[0].fireOpen();

      setupResult.binaryContexts[0].callbacks.loadedCallback();
      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      expect(setupResult.reset).toHaveBeenCalled();
      expect(setupResult.surfaceCommittedCallback).toHaveBeenLastCalledWith('video');
    });

    it('should not report image media when the image surface has no element', () => {
      const { session, websockets, binaryContexts, mediaLoadedCallback } = setup();
      const surfaceRefs = createSurfaces();
      const surfaces: SessionSurfaces = {
        video: surfaceRefs.surfaces.video,
        image: { ...surfaceRefs.surfaces.image, getElement: () => null },
      };
      session.connect('http://host/api/ws?src=camera', surfaces, ['mjpeg']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).not.toHaveBeenCalled();
    });

    it('should reconnect when handed a new surfaces object for the same target', () => {
      const { session, surfaces, websockets, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);

      // A different surfaces object (e.g. the component remounted its elements)
      // is a new target even when the URL and modes match.
      session.connect('http://host/api/ws?src=camera', createSurfaces().surfaces, [
        'mse',
      ]);

      expect(websockets[0].close).toHaveBeenCalled();
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should abandon the binary lane when the video element is detached at open', () => {
      const { session, surfaces, websockets, createBinarySource, setVideoElement } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      setVideoElement(null);
      websockets[0].fireOpen();

      expect(createBinarySource).not.toHaveBeenCalled();
    });

    it('should abandon a WebRTC-only lane when the video element is detached at open', () => {
      const { session, surfaces, websockets, createWebRTCSource, setVideoElement } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      setVideoElement(null);
      websockets[0].fireOpen();

      expect(createWebRTCSource).not.toHaveBeenCalled();
    });

    it('should still commit a WebRTC win when the video element is detached', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.setVideoElement(null);

      setupResult.webRTCContexts[0].callbacks.loadedCallback();

      // No element to attach the stream to, but the win still tears down the
      // binary lane and reports loaded media (dimensions come from the
      // off-screen element).
      expect(setupResult.binarySources[0].stop).toHaveBeenCalled();
      expect(setupResult.mediaLoadedCallback).toHaveBeenCalledWith(
        expect.objectContaining({ technology: ['webrtc'] }),
      );
    });

    it('should skip hiding controls and reporting when the video element is detached on commit', () => {
      const {
        session,
        surfaces,
        websockets,
        binaryContexts,
        mediaLoadedCallback,
        setVideoElement,
      } = setup({ controls: true });
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      setVideoElement(null);

      expect(() => binaryContexts[0].callbacks.loadedCallback()).not.toThrow();
      expect(mediaLoadedCallback).not.toHaveBeenCalled();
    });

    it('should skip resetting a detached video surface on a switch to image', () => {
      const {
        session,
        surfaces,
        websockets,
        binaryContexts,
        surfaceCommittedCallback,
        setVideoElement,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse', 'mjpeg']);
      websockets[0].fireOpen();

      binaryContexts[0].callbacks.loadedCallback();
      binaryContexts[0].callbacks.failedCallback('media_error');
      setVideoElement(null);
      binaryContexts[1].callbacks.loadedCallback();

      expect(surfaceCommittedCallback).toHaveBeenLastCalledWith('image');
    });

    it('should reconnect without clearing a detached element when committed WebRTC fails', () => {
      const {
        session,
        surfaces,
        video,
        websockets,
        webRTCContexts,
        createWebSocket,
        setVideoElement,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();

      // Detached at the moment of failure: the clear is skipped, not attempted.
      setVideoElement(null);
      webRTCContexts[0].callbacks.failedCallback('media_error');

      // Re-attached in time for the retry, which then reconnects normally.
      setVideoElement(video);
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('lifecycle', () => {
    it('should stop the source and reconnect on unexpected closure', () => {
      const { session, surfaces, websockets, binarySources, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      websockets[0].fireClose();

      expect(binarySources[0].stop).toHaveBeenCalled();
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should escalate via the error callback after exhausting reconnect attempts', () => {
      const { session, surfaces, websockets, createWebSocket, streamErrorCallback } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);

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

      expect(createWebSocket).toHaveBeenCalledTimes(4);
      expect(streamErrorCallback).toHaveBeenCalledTimes(1);

      // The socket dropped with no source reporting a cause.
      expect(streamErrorCallback).toHaveBeenCalledWith(null);
      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(4);
    });

    it('should escalate with the most recent source failure reason', () => {
      const { session, surfaces, websockets, binaryContexts, streamErrorCallback } =
        setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);

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

      expect(streamErrorCallback).toHaveBeenCalledWith('unsupported');
    });

    it('should reset the reconnect budget after a successful media load', () => {
      const {
        session,
        surfaces,
        websockets,
        binaryContexts,
        createWebSocket,
        streamErrorCallback,
      } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);

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

      expect(streamErrorCallback).not.toHaveBeenCalled();
      expect(createWebSocket).toHaveBeenCalledTimes(6);
    });

    it('should tear down all lanes and clear the video on reset', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.session.reset();

      expect(setupResult.binarySources[0].stop).toHaveBeenCalled();
      expect(setupResult.webRTCSources[0].stop).toHaveBeenCalled();
      expect(setupResult.websockets[0].close).toHaveBeenCalled();
      expect(setupResult.video.srcObject).toBeNull();
    });

    it('should not reconnect after reset', () => {
      const { session, surfaces, websockets, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      websockets[0].fireClose();
      session.reset();
      vi.advanceTimersByTime(2 * 1000);

      expect(createWebSocket).toHaveBeenCalledTimes(1);
    });

    it('should allow connecting to the same target after reset', () => {
      const { session, surfaces, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      session.reset();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);

      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should reconnect when a committed binary source later fails', () => {
      const { session, surfaces, websockets, binaryContexts, createWebSocket } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();
      binaryContexts[0].callbacks.failedCallback('media_error');

      vi.advanceTimersByTime(2 * 1000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);
    });

    it('should ignore a loaded callback from a retired binary source', () => {
      const setupResult = setup();
      startSourceRace(setupResult);

      // WebRTC wins and stops the binary lane.
      setupResult.webRTCContexts[0].callbacks.loadedCallback();
      setupResult.mediaLoadedCallback.mockClear();
      setupResult.binaryContexts[0].callbacks.loadedCallback();

      expect(setupResult.mediaLoadedCallback).not.toHaveBeenCalled();
    });

    it('should ignore a failed callback from a retired binary source', () => {
      const setupResult = setup();
      startSourceRace(setupResult);
      setupResult.webRTCContexts[0].callbacks.loadedCallback();
      setupResult.binarySources[0].stop.mockClear();
      setupResult.binaryContexts[0].callbacks.failedCallback('media_error');

      expect(setupResult.binarySources[0].stop).not.toHaveBeenCalled();
    });

    it('should ignore a failed callback from a retired WebRTC source', () => {
      const { session, surfaces, websockets, webRTCContexts, webRTCSources } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();
      webRTCContexts[0].callbacks.loadedCallback();
      webRTCContexts[0].callbacks.failedCallback('media_error');
      webRTCSources[0].stop.mockClear();
      webRTCContexts[0].callbacks.failedCallback('media_error');

      expect(webRTCSources[0].stop).not.toHaveBeenCalled();
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
      expect(setupResult.binarySources[0].stop).toHaveBeenCalled();
    });

    it('should not report media that cannot be described', () => {
      const { session, websockets, binaryContexts, mediaLoadedCallback } = setup();
      const notAVideo = document.createElement('div');
      session.connect(
        'http://host/api/ws?src=camera',
        createSurfaces(notAVideo as unknown as HTMLVideoElement).surfaces,
        ['mse'],
      );
      websockets[0].fireOpen();
      binaryContexts[0].callbacks.loadedCallback();

      expect(mediaLoadedCallback).not.toHaveBeenCalled();
    });

    it('should ignore callbacks fired while a binary source is constructed', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const mediaLoadedCallback = vi.fn();
      const createBinarySource = vi.fn(
        (_mode, _targets, _channel, callbacks: StreamSourceCallbacks) => {
          callbacks.loadedCallback();
          callbacks.failedCallback('media_error');
          return null;
        },
      );

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          surfaceCommittedCallback: vi.fn(),
          getCardWideConfig: () => null,
          mediaLoadedCallback,
          streamErrorCallback: vi.fn(),
        },
        { createWebSocket, createBinarySource },
      );
      session.connect('http://host/api/ws?src=camera', createSurfaces().surfaces, [
        'mse',
      ]);
      websockets[0].fireOpen();

      expect(mediaLoadedCallback).not.toHaveBeenCalled();
    });

    it('should ignore callbacks fired while a WebRTC source is constructed', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });
      const mediaLoadedCallback = vi.fn();
      const createWebRTCSource = vi.fn(
        (context: StreamSourceContext<VideoStreamTarget>) => {
          context.callbacks.loadedCallback();
          context.callbacks.failedCallback('media_error');
          return mock<WebRTCStreamSource>();
        },
      );

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          surfaceCommittedCallback: vi.fn(),
          getCardWideConfig: () => null,
          mediaLoadedCallback,
          streamErrorCallback: vi.fn(),
        },
        { createWebSocket, createWebRTCSource },
      );
      session.connect('http://host/api/ws?src=camera', createSurfaces().surfaces, [
        'webrtc',
      ]);
      websockets[0].fireOpen();

      expect(mediaLoadedCallback).not.toHaveBeenCalled();
    });

    it('should use the default binary source factory when none is injected', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          surfaceCommittedCallback: vi.fn(),
          getCardWideConfig: () => null,
          mediaLoadedCallback: vi.fn(),
          streamErrorCallback: vi.fn(),
        },
        { createWebSocket },
      );
      session.connect('http://host/api/ws?src=camera', createSurfaces().surfaces, [
        'mse',
      ]);

      // The real MSE source reports itself unsupported on jsdom, so the session
      // closes and retries; the point is that the default factory was used.
      websockets[0].fireOpen();

      expect(websockets[0].close).toHaveBeenCalled();
      session.reset();
    });

    it('should use the default WebRTC source factory when none is injected', () => {
      vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection);
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          surfaceCommittedCallback: vi.fn(),
          getCardWideConfig: () => null,
          mediaLoadedCallback: vi.fn(),
          streamErrorCallback: vi.fn(),
        },
        { createWebSocket },
      );
      session.connect('http://host/api/ws?src=camera', createSurfaces().surfaces, [
        'webrtc',
      ]);

      expect(() => websockets[0].fireOpen()).not.toThrow();
      session.reset();
      vi.unstubAllGlobals();
    });

    it('should create an off-screen video with the default factory when none is injected', () => {
      const websockets: FakeWebSocket[] = [];
      const createWebSocket = vi.fn<(url: string) => WebSocket>(() => {
        const websocket = new FakeWebSocket();
        websockets.push(websocket);
        return websocket.asWebSocket();
      });

      const webRTCContexts: StreamSourceContext<VideoStreamTarget>[] = [];
      const createWebRTCSource = vi.fn(
        (context: StreamSourceContext<VideoStreamTarget>) => {
          webRTCContexts.push(context);
          return mock<WebRTCStreamSource>();
        },
      );

      const createBinarySource = vi.fn(
        (): BinarySource => ({ source: mock<StreamSource>(), surface: 'video' }),
      );
      const { surfaces, video } = createSurfaces();

      const session = new Go2RTCSessionController(
        {
          getControls: () => false,
          surfaceCommittedCallback: vi.fn(),
          getCardWideConfig: () => null,
          mediaLoadedCallback: vi.fn(),
          streamErrorCallback: vi.fn(),
        },
        { createWebSocket, createBinarySource, createWebRTCSource },
      );
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse', 'webrtc']);
      websockets[0].fireOpen();

      // The off-screen video is a real element, not the connected one.
      expect(webRTCContexts[0].target.video).toBeInstanceOf(HTMLVideoElement);
      expect(webRTCContexts[0].target.video).not.toBe(video);
    });
  });

  describe('source failure logging', () => {
    it('should log the failing binary mode and reason when debug logging is on', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);
      const { session, surfaces, websockets, binaryContexts } = setup({
        cardWideConfig: { debug: { logging: true } },
      });
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();

      binaryContexts[0].callbacks.failedCallback('media_error');

      expect(consoleSpy).toHaveBeenCalledWith('go2rtc-experimental source failed', {
        lane: 'binary',
        mode: 'mse',
        reason: 'media_error',
      });
    });

    it('should log the webrtc lane and reason without a mode', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);
      const { session, surfaces, websockets, webRTCContexts } = setup({
        cardWideConfig: { debug: { logging: true } },
      });
      session.connect('http://host/api/ws?src=camera', surfaces, ['webrtc']);
      websockets[0].fireOpen();

      webRTCContexts[0].callbacks.failedCallback('connect_timeout');

      expect(consoleSpy).toHaveBeenCalledWith('go2rtc-experimental source failed', {
        lane: 'webrtc',
        reason: 'connect_timeout',
      });
    });

    it('should not log when debug logging is off', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockReturnValue(undefined);
      const { session, surfaces, websockets, binaryContexts } = setup();
      session.connect('http://host/api/ws?src=camera', surfaces, ['mse']);
      websockets[0].fireOpen();

      binaryContexts[0].callbacks.failedCallback('media_error');

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
