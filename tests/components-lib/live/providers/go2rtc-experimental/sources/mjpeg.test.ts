import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MJPEGStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mjpeg';
import type {
  ImageStreamTarget,
  StreamSourceContext,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { flushPromises } from '../../../../../test-utils';
import { FakeStreamSourceChannel } from '../test-utils';

// @vitest-environment jsdom
describe('MJPEGStreamSource', () => {
  const setup = () => {
    const channel = new FakeStreamSourceChannel();
    const loadedCallback = vi.fn();
    const failedCallback = vi.fn();
    const showFrame = vi.fn<(blob: Blob) => Promise<void>>(() => Promise.resolve());

    const context: StreamSourceContext<ImageStreamTarget> = {
      target: { kind: 'image', showFrame },
      channel,
      callbacks: { loadedCallback, failedCallback },
    };
    const source = new MJPEGStreamSource(context);

    return { channel, failedCallback, loadedCallback, showFrame, source };
  };

  const frame = (): ArrayBuffer => new TextEncoder().encode('Hi').buffer;

  it('should request the mjpeg stream on start', () => {
    const { source, channel } = setup();
    source.start();

    expect(channel.sent).toEqual([{ type: 'mjpeg' }]);
    expect(channel.binaryCallback).not.toBeNull();
  });

  it('should show each frame as a JPEG image', () => {
    const { source, channel, showFrame } = setup();
    source.start();
    channel.binaryCallback?.(frame());

    expect(showFrame).toHaveBeenCalledTimes(1);
    const shown = showFrame.mock.calls[0][0] as Blob;
    expect(shown).toBeInstanceOf(Blob);
    expect(shown.type).toBe('image/jpeg');
    expect(shown.size).toBe(2);
  });

  it('should report loaded only on the first frame', async () => {
    const { source, channel, loadedCallback } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    channel.binaryCallback?.(frame());
    await flushPromises();

    expect(loadedCallback).toHaveBeenCalledTimes(1);
  });

  it('should not report loaded when stopped before the first frame decodes', async () => {
    const { source, channel, loadedCallback, showFrame } = setup();
    let resolveDecode: () => void = () => {};
    showFrame.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecode = resolve;
      }),
    );
    source.start();
    channel.binaryCallback?.(frame());

    // Stop before the frame's decode resolves; the deferred loaded report must
    // then be dropped.
    source.stop();
    resolveDecode();
    await flushPromises();

    expect(loadedCallback).not.toHaveBeenCalled();
  });

  it('should fail on a server error for mjpeg', () => {
    const { source, channel, failedCallback } = setup();
    source.start();
    channel.receiveMessage({ type: 'error', value: 'mjpeg: stream not found' });

    expect(failedCallback).toHaveBeenCalledWith('server_error');
  });

  it('should ignore a server error for another mode', () => {
    const { source, channel, failedCallback } = setup();
    source.start();
    channel.receiveMessage({ type: 'error', value: 'mse: stream not found' });

    expect(failedCallback).not.toHaveBeenCalled();
  });

  it('should stop cleanly', () => {
    const { source, channel } = setup();
    source.start();
    source.stop();

    expect(channel.binaryCallback).toBeNull();
    expect(channel.getMessageCallbackCount()).toBe(0);
  });

  it('should tolerate stopping before starting', () => {
    const { source } = setup();

    expect(() => source.stop()).not.toThrow();
  });

  it('should report no-pause capabilities', () => {
    const { source } = setup();

    expect(source.getCapabilities()).toEqual({ supportsPause: false });
  });

  it('should report mjpeg technology', () => {
    const { source } = setup();

    expect(source.getTechnology()).toEqual(['mjpeg']);
  });

  it('should report a video-only stream profile', () => {
    const { source } = setup();

    expect(source.getStreamProfile()).toEqual({
      hasVideo: true,
      hasH265Video: false,
      hasAudio: false,
      hasAACAudio: false,
    });
  });

  describe('first-frame timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should fail when no frame arrives within the timeout', () => {
      const { source, failedCallback } = setup();
      source.start();
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).toHaveBeenCalledWith('connect_timeout');
    });

    it('should not fail once a frame has arrived', () => {
      const { source, channel, failedCallback } = setup();
      source.start();
      channel.binaryCallback?.(frame());
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toHaveBeenCalled();
    });

    it('should not fail after stop', () => {
      const { source, failedCallback } = setup();
      source.start();
      source.stop();
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toHaveBeenCalled();
    });
  });
});
