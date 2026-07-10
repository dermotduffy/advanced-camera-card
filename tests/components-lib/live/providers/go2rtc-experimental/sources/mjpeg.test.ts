import { describe, expect, it, vi } from 'vitest';

import { MJPEGStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mjpeg';
import type { StreamSourceContext } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { FakeStreamSourceChannel } from '../test-utils';

// @vitest-environment jsdom
describe('MJPEGStreamSource', () => {
  const setup = () => {
    const video = document.createElement('video');
    const channel = new FakeStreamSourceChannel();
    const loadedCallback = vi.fn();
    const failedCallback = vi.fn();

    const context: StreamSourceContext = {
      video,
      channel,
      callbacks: { loadedCallback, failedCallback },
    };
    const source = new MJPEGStreamSource(context);

    return { channel, failedCallback, loadedCallback, source, video };
  };

  const frame = (): ArrayBuffer => new TextEncoder().encode('Hi').buffer;

  it('should disable controls and request the mjpeg stream on start', () => {
    const { source, channel, video } = setup();
    video.controls = true;
    source.start();

    expect(video.controls).toBe(false);
    expect(channel.sent).toEqual([{ type: 'mjpeg' }]);
    expect(channel.binaryCallback).not.toBeNull();
  });

  it('should show each frame as a JPEG poster', () => {
    const { source, channel, video } = setup();
    source.start();
    channel.binaryCallback?.(frame());

    expect(video.poster).toContain('data:image/jpeg;base64,SGk=');
  });

  it('should report loaded only on the first frame', () => {
    const { source, channel, loadedCallback } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    channel.binaryCallback?.(frame());

    expect(loadedCallback).toBeCalledTimes(1);
  });

  it('should fail on a server error for mjpeg', () => {
    const { source, channel, failedCallback } = setup();
    source.start();
    channel.receiveMessage({ type: 'error', value: 'mjpeg: stream not found' });

    expect(failedCallback).toBeCalledWith('server-error');
  });

  it('should ignore a server error for another mode', () => {
    const { source, channel, failedCallback } = setup();
    source.start();
    channel.receiveMessage({ type: 'error', value: 'mse: stream not found' });

    expect(failedCallback).not.toBeCalled();
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
});
