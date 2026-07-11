import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MSEStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mse';
import type {
  StreamSourceContext,
  VideoStreamTarget,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import {
  CHROME_USER_AGENT,
  createFakeMediaSourceFactory,
  createTimeRanges,
  FakeMediaSourceInstance,
  FakeStreamSourceChannel,
  SAFARI_17_USER_AGENT,
} from '../test-utils';

const ALL_CHROME_CODECS =
  'avc1.640029,avc1.64002A,avc1.640033,hvc1.1.6.L153.B0,mp4a.40.2,mp4a.40.5,flac,opus';

// @vitest-environment jsdom
describe('MSEStreamSource', () => {
  const setup = (options?: { userAgent?: string; unsupported?: boolean }) => {
    const video = document.createElement('video');
    const channel = new FakeStreamSourceChannel();
    const loadedCallback = vi.fn();
    const failedCallback = vi.fn();
    const context: StreamSourceContext<VideoStreamTarget> = {
      target: { kind: 'video', video },
      channel,
      callbacks: { loadedCallback, failedCallback },
    };
    const instance = new FakeMediaSourceInstance();
    const source = new MSEStreamSource(context, {
      createMediaSource: createFakeMediaSourceFactory(
        options?.unsupported ? null : instance,
      ),
      userAgent: options?.userAgent ?? CHROME_USER_AGENT,
    });
    return { channel, failedCallback, instance, loadedCallback, source, video };
  };

  type SetupResult = ReturnType<typeof setup>;

  const negotiate = (setupResult: SetupResult): void => {
    setupResult.source.start();
    setupResult.instance.fireSourceOpen();
    setupResult.channel.receiveMessage({
      type: 'mse',
      value: 'video/mp4; codecs="avc1.640029,mp4a.40.2"',
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startup', () => {
    it('should fail without MediaSource support', () => {
      const { source, failedCallback } = setup({ unsupported: true });
      source.start();

      expect(failedCallback).toBeCalledWith('unsupported');
    });

    it('should attach the media source to the video on start', () => {
      const { source, instance, video } = setup();
      source.start();

      expect(instance.attach).toBeCalledWith(video);
    });
  });

  describe('negotiation', () => {
    it('should offer supported codecs when the source opens', () => {
      const { source, instance, channel } = setup();
      source.start();
      instance.fireSourceOpen();

      expect(channel.sent).toEqual([{ type: 'mse', value: ALL_CHROME_CODECS }]);
    });

    it('should offer Safari-reliable codecs on Safari', () => {
      const { source, instance, channel } = setup({ userAgent: SAFARI_17_USER_AGENT });
      source.start();
      instance.fireSourceOpen();

      expect(channel.sent).toEqual([
        {
          type: 'mse',
          value:
            'avc1.640029,avc1.64002A,avc1.640033,hvc1.1.6.L153.B0,mp4a.40.2,mp4a.40.5,flac',
        },
      ]);
    });

    it('should exclude codecs the media source does not support', () => {
      const { source, instance, channel } = setup();
      instance.isTypeSupported.mockImplementation(
        (mimeType: string) => mimeType === 'video/mp4; codecs="avc1.640029"',
      );
      source.start();
      instance.fireSourceOpen();

      expect(channel.sent).toEqual([{ type: 'mse', value: 'avc1.640029' }]);
    });

    it('should fail when negotiation times out', () => {
      const { source, instance, failedCallback } = setup();
      source.start();
      instance.fireSourceOpen();
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).toBeCalledWith('negotiation_timeout');
    });

    it('should not time out after a successful negotiation', () => {
      const setupResult = setup();
      negotiate(setupResult);
      vi.advanceTimersByTime(5 * 1000);

      expect(setupResult.failedCallback).not.toBeCalled();
    });

    it('should create a source buffer in segments mode on negotiation', () => {
      const setupResult = setup();
      negotiate(setupResult);

      expect(setupResult.instance.addSourceBuffer).toBeCalledWith(
        'video/mp4; codecs="avc1.640029,mp4a.40.2"',
      );
      expect(setupResult.instance.sourceBuffer.mode).toBe('segments');
      expect(setupResult.channel.binaryCallback).not.toBeNull();
    });

    it('should ignore a repeated negotiation response', () => {
      const setupResult = setup();
      negotiate(setupResult);
      setupResult.channel.receiveMessage({ type: 'mse', value: 'video/mp4' });

      expect(setupResult.instance.addSourceBuffer).toBeCalledTimes(1);
    });

    it('should ignore negotiation responses without a string value', () => {
      const setupResult = setup();
      setupResult.source.start();
      setupResult.channel.receiveMessage({ type: 'mse', value: 42 });

      expect(setupResult.instance.addSourceBuffer).not.toBeCalled();
    });

    it('should ignore unrelated messages', () => {
      const setupResult = setup();
      setupResult.source.start();
      setupResult.channel.receiveMessage({ type: 'webrtc/answer', value: 'sdp' });

      expect(setupResult.instance.addSourceBuffer).not.toBeCalled();
      expect(setupResult.failedCallback).not.toBeCalled();
    });
  });

  describe('server errors', () => {
    it('should fail on a server error for mse', () => {
      const { source, instance, channel, failedCallback } = setup();
      source.start();
      instance.fireSourceOpen();
      channel.receiveMessage({ type: 'error', value: 'mse: stream not found' });

      expect(failedCallback).toBeCalledWith('server_error');

      // The negotiation timer must have stopped.
      failedCallback.mockClear();
      vi.advanceTimersByTime(5 * 1000);
      expect(failedCallback).not.toBeCalled();
    });

    it('should ignore server errors for other modes', () => {
      const { source, channel, failedCallback } = setup();
      source.start();
      channel.receiveMessage({ type: 'error', value: 'webrtc/offer: failed' });

      expect(failedCallback).not.toBeCalled();
    });

    it('should ignore server errors without a string value', () => {
      const { source, channel, failedCallback } = setup();
      source.start();
      channel.receiveMessage({ type: 'error' });

      expect(failedCallback).not.toBeCalled();
    });
  });

  describe('source buffer', () => {
    it('should fail when the source buffer cannot be created', () => {
      const { source, instance, channel, failedCallback } = setup();
      instance.addSourceBuffer.mockImplementation(() => {
        throw new Error('InvalidStateError');
      });
      source.start();
      instance.fireSourceOpen();
      channel.receiveMessage({ type: 'mse', value: 'video/mp4' });

      expect(failedCallback).toBeCalledWith('media_error');
    });

    it('should append binary data directly when idle', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const data = new ArrayBuffer(8);
      setupResult.channel.binaryCallback?.(data);

      expect(setupResult.instance.sourceBuffer.appendBuffer).toBeCalledWith(data);
    });

    it('should swallow direct append failures', () => {
      const setupResult = setup();
      negotiate(setupResult);
      setupResult.instance.sourceBuffer.appendBuffer.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() =>
        setupResult.channel.binaryCallback?.(new ArrayBuffer(8)),
      ).not.toThrow();
      expect(setupResult.failedCallback).not.toBeCalled();
    });

    it('should stage binary data while the source buffer updates', () => {
      const setupResult = setup();
      negotiate(setupResult);
      setupResult.instance.sourceBuffer.updating = true;
      const staged = new ArrayBuffer(8);
      setupResult.channel.binaryCallback?.(staged);

      expect(setupResult.instance.sourceBuffer.appendBuffer).not.toBeCalled();

      setupResult.instance.sourceBuffer.updating = false;
      setupResult.instance.sourceBuffer.fireUpdateEnd();

      expect(setupResult.instance.sourceBuffer.appendBuffer).toBeCalledWith(staged);
    });

    it('should stage binary data behind earlier staged data', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;

      sourceBuffer.updating = true;
      const first = new ArrayBuffer(8);
      const second = new ArrayBuffer(4);
      setupResult.channel.binaryCallback?.(first);
      sourceBuffer.updating = false;
      setupResult.channel.binaryCallback?.(second);

      expect(sourceBuffer.appendBuffer).not.toBeCalled();

      sourceBuffer.fireUpdateEnd();
      expect(sourceBuffer.appendBuffer).toHaveBeenNthCalledWith(1, first);

      sourceBuffer.fireUpdateEnd();
      expect(sourceBuffer.appendBuffer).toHaveBeenNthCalledWith(2, second);
    });

    it('should fail when staged data exceeds the pending limit', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;

      sourceBuffer.updating = true;
      setupResult.channel.binaryCallback?.(new ArrayBuffer(2 * 1024 * 1024));
      expect(setupResult.failedCallback).not.toBeCalled();

      setupResult.channel.binaryCallback?.(new ArrayBuffer(1));
      expect(setupResult.failedCallback).toBeCalledWith('buffer_overflow');
    });
  });

  describe('live edge', () => {
    it('should do nothing on updateend while still updating', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[0, 20]]);
      sourceBuffer.updating = true;
      sourceBuffer.fireUpdateEnd();

      expect(sourceBuffer.remove).not.toBeCalled();
    });

    it('should do nothing on updateend without buffered content', () => {
      const setupResult = setup();
      negotiate(setupResult);
      setupResult.instance.sourceBuffer.fireUpdateEnd();

      expect(setupResult.instance.sourceBuffer.remove).not.toBeCalled();
      expect(setupResult.instance.setLiveSeekableRange).not.toBeCalled();
    });

    it('should trim media behind the retained window', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[0, 20]]);
      setupResult.video.currentTime = 19;
      sourceBuffer.fireUpdateEnd();

      expect(sourceBuffer.remove).toBeCalledWith(0, 15);
      expect(setupResult.instance.setLiveSeekableRange).toBeCalledWith(15, 20);
    });

    it('should not trim when all media is within the retained window', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[16, 20]]);
      setupResult.video.currentTime = 19;
      sourceBuffer.fireUpdateEnd();

      expect(sourceBuffer.remove).not.toBeCalled();
    });

    it('should snap playback into the retained window', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[0, 20]]);
      setupResult.video.currentTime = 2;
      sourceBuffer.fireUpdateEnd();

      expect(setupResult.video.currentTime).toBe(15);
    });

    it('should raise the playback rate when lag rises above the stream norm', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[16, 20]]);

      // Establish a healthy 1s lag norm.
      setupResult.video.currentTime = 19;
      sourceBuffer.fireUpdateEnd();
      expect(setupResult.video.playbackRate).toBe(1);

      // A 5s lag now exceeds the adaptive threshold and triggers a gentle
      // catch-up above realtime.
      setupResult.video.currentTime = 15;
      sourceBuffer.fireUpdateEnd();
      expect(setupResult.video.playbackRate).toBeGreaterThan(1);
      expect(setupResult.video.playbackRate).toBeLessThan(1.1);
    });

    it('should reset the playback rate when caught up', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[16, 20]]);
      setupResult.video.currentTime = 19;
      setupResult.video.playbackRate = 2;
      sourceBuffer.fireUpdateEnd();

      expect(setupResult.video.playbackRate).toBe(1);
    });

    it('should leave an unchanged playback rate alone', () => {
      const setupResult = setup();
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[16, 20]]);
      setupResult.video.currentTime = 19;
      sourceBuffer.fireUpdateEnd();

      expect(setupResult.video.playbackRate).toBe(1);
    });

    it('should jump to the live edge on WebKit instead of changing the rate', () => {
      const setupResult = setup({ userAgent: SAFARI_17_USER_AGENT });
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[12, 20]]);
      setupResult.video.currentTime = 16;
      sourceBuffer.fireUpdateEnd();

      expect(setupResult.video.currentTime).toBe(19.25);
      expect(setupResult.video.playbackRate).toBe(1);
    });

    it('should respect the jump cooldown on WebKit', () => {
      const setupResult = setup({ userAgent: SAFARI_17_USER_AGENT });
      negotiate(setupResult);
      const sourceBuffer = setupResult.instance.sourceBuffer;
      sourceBuffer.buffered = createTimeRanges([[12, 20]]);
      setupResult.video.currentTime = 16;
      sourceBuffer.fireUpdateEnd();

      expect(setupResult.video.currentTime).toBe(19.25);

      // Fall behind again immediately: within the cooldown there is no second
      // jump.
      setupResult.video.currentTime = 16;
      sourceBuffer.fireUpdateEnd();
      expect(setupResult.video.currentTime).toBe(16);

      // After the cooldown the jump resumes.
      vi.advanceTimersByTime(6 * 1000);
      sourceBuffer.fireUpdateEnd();
      expect(setupResult.video.currentTime).toBe(19.25);
    });
  });

  describe('media events', () => {
    it('should report loaded media', () => {
      const setupResult = setup();
      negotiate(setupResult);
      setupResult.video.dispatchEvent(new Event('loadeddata'));

      expect(setupResult.loadedCallback).toBeCalledTimes(1);
    });

    it('should fail on video element errors', () => {
      const setupResult = setup();
      setupResult.source.start();
      setupResult.video.dispatchEvent(new Event('error'));

      expect(setupResult.failedCallback).toBeCalledWith('media_error');
    });
  });

  describe('lifecycle', () => {
    it('should stop cleanly', () => {
      const setupResult = setup();
      negotiate(setupResult);
      setupResult.source.stop();

      expect(setupResult.instance.detach).toBeCalledWith(setupResult.video);
      expect(setupResult.channel.binaryCallback).toBeNull();
      expect(setupResult.channel.getMessageCallbackCount()).toBe(0);
      expect(setupResult.instance.getSourceOpenCallbackCount()).toBe(0);

      setupResult.video.dispatchEvent(new Event('loadeddata'));
      setupResult.video.dispatchEvent(new Event('error'));
      expect(setupResult.loadedCallback).not.toBeCalled();
      expect(setupResult.failedCallback).not.toBeCalled();

      setupResult.instance.sourceBuffer.buffered = createTimeRanges([[0, 20]]);
      setupResult.instance.sourceBuffer.fireUpdateEnd();
      expect(setupResult.instance.sourceBuffer.remove).not.toBeCalled();
    });

    it('should stop the negotiation timer on stop', () => {
      const setupResult = setup();
      setupResult.source.start();
      setupResult.instance.fireSourceOpen();
      setupResult.source.stop();
      vi.advanceTimersByTime(5 * 1000);

      expect(setupResult.failedCallback).not.toBeCalled();
    });

    it('should tolerate stopping before starting', () => {
      const { source } = setup();

      expect(() => source.stop()).not.toThrow();
    });
  });

  describe('reporting', () => {
    it('should report capabilities before negotiation', () => {
      const { source } = setup();

      // Without negotiated codecs, audio detection falls back to the video
      // element, whose jsdom audio track list is empty.
      expect(source.getCapabilities()).toEqual({
        supportsPause: true,
        hasAudio: false,
        has2WayAudio: false,
      });
    });

    it('should report audio from negotiated codecs', () => {
      const setupResult = setup();
      negotiate(setupResult);

      expect(setupResult.source.getCapabilities()).toEqual({
        supportsPause: true,
        hasAudio: true,
        has2WayAudio: false,
      });
    });

    it('should report no audio for video-only codecs', () => {
      const setupResult = setup();
      setupResult.source.start();
      setupResult.instance.fireSourceOpen();
      setupResult.channel.receiveMessage({
        type: 'mse',
        value: 'video/mp4; codecs="avc1.640029"',
      });

      expect(setupResult.source.getCapabilities()).toEqual({
        supportsPause: true,
        hasAudio: false,
        has2WayAudio: false,
      });
    });

    it('should report technology', () => {
      const { source } = setup();

      expect(source.getTechnology()).toEqual(['mse']);
    });

    it('should report an empty stream profile before negotiation', () => {
      const { source } = setup();

      expect(source.getStreamProfile()).toEqual({
        hasVideo: false,
        hasH265Video: false,
        hasAudio: false,
        hasAACAudio: false,
      });
    });

    it('should report an H.264 and AAC stream profile from negotiated codecs', () => {
      const setupResult = setup();
      negotiate(setupResult);

      expect(setupResult.source.getStreamProfile()).toEqual({
        hasVideo: true,
        hasH265Video: false,
        hasAudio: true,
        hasAACAudio: true,
      });
    });

    it('should report an H.265 stream profile', () => {
      const setupResult = setup();
      setupResult.source.start();
      setupResult.instance.fireSourceOpen();
      setupResult.channel.receiveMessage({
        type: 'mse',
        value: 'video/mp4; codecs="hvc1.1.6.L153.B0,opus"',
      });

      expect(setupResult.source.getStreamProfile()).toEqual({
        hasVideo: true,
        hasH265Video: true,
        hasAudio: true,
        hasAACAudio: false,
      });
    });
  });
});
