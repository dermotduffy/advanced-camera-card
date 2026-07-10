import { describe, expect, it, vi } from 'vitest';

import { MP4StreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mp4';
import type { StreamSourceContext } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { FakeStreamSourceChannel } from '../test-utils';

class FakeCanvasContext {
  public drawImage = vi.fn();
}

class FakeCanvas {
  public width = 0;
  public height = 0;
  public context: FakeCanvasContext | null = new FakeCanvasContext();
  public getContext = vi.fn(() => this.context);
  public toDataURL = vi.fn(() => 'data:image/jpeg;base64,poster');

  public asCanvas(): HTMLCanvasElement {
    return this as unknown as HTMLCanvasElement;
  }
}

// @vitest-environment jsdom
describe('MP4StreamSource', () => {
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
    const decoderVideo = document.createElement('video');
    const canvas = new FakeCanvas();
    const createVideoElement = vi.fn(() => decoderVideo);
    const source = new MP4StreamSource(context, {
      createVideoElement,
      createCanvasElement: () => canvas.asCanvas(),
    });
    return {
      canvas,
      channel,
      createVideoElement,
      decoderVideo,
      failedCallback,
      loadedCallback,
      source,
      video,
    };
  };

  const frame = (): ArrayBuffer => new TextEncoder().encode('Hi').buffer;

  it('should request the mp4 stream on start', () => {
    const { source, channel } = setup();
    source.start();

    expect(channel.sent[0].type).toBe('mp4');
    expect(channel.binaryCallback).not.toBeNull();
  });

  it('should feed each frame to a muted autoplay decoder video', () => {
    const { source, channel, decoderVideo } = setup();
    source.start();
    channel.binaryCallback?.(frame());

    expect(decoderVideo.autoplay).toBe(true);
    expect(decoderVideo.muted).toBe(true);
    expect(decoderVideo.getAttribute('src')).toBe('data:video/mp4;base64,SGk=');
  });

  it('should reuse the decoder across frames', () => {
    const { source, channel, createVideoElement } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    channel.binaryCallback?.(frame());

    // Second frame reuses the same decoder rather than creating another.
    expect(createVideoElement).toBeCalledTimes(1);
  });

  it('should draw a decoded frame to the poster', () => {
    const { source, channel, decoderVideo, canvas, video, loadedCallback } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    decoderVideo.dispatchEvent(new Event('loadeddata'));

    expect(canvas.context?.drawImage).toBeCalled();
    expect(video.poster).toContain('data:image/jpeg;base64,poster');
    expect(loadedCallback).toBeCalledTimes(1);
  });

  it('should report loaded only on the first drawn frame', () => {
    const { source, channel, decoderVideo, loadedCallback } = setup();
    source.start();

    channel.binaryCallback?.(frame());

    decoderVideo.dispatchEvent(new Event('loadeddata'));
    decoderVideo.dispatchEvent(new Event('loadeddata'));

    expect(loadedCallback).toBeCalledTimes(1);
  });

  it('should do nothing when the canvas has no 2d context', () => {
    const { source, channel, decoderVideo, canvas, video } = setup();
    canvas.context = null;
    source.start();
    channel.binaryCallback?.(frame());
    decoderVideo.dispatchEvent(new Event('loadeddata'));

    expect(video.poster).toBe('');
  });

  it('should fail on a server error for mp4', () => {
    const { source, channel, failedCallback } = setup();
    source.start();
    channel.receiveMessage({ type: 'error', value: 'mp4: stream not found' });

    expect(failedCallback).toBeCalledWith('server_error');
  });

  it('should clear the decoder on stop', () => {
    const { source, channel, decoderVideo } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    source.stop();

    expect(decoderVideo.hasAttribute('src')).toBe(false);
    expect(channel.binaryCallback).toBeNull();
  });

  it('should report mp4 technology', () => {
    const { source } = setup();

    expect(source.getTechnology()).toEqual(['mp4']);
  });

  it('should default to document element factories when none are injected', () => {
    const contextVideo = document.createElement('video');
    const channel = new FakeStreamSourceChannel();
    const source = new MP4StreamSource({
      video: contextVideo,
      channel,
      callbacks: { loadedCallback: vi.fn(), failedCallback: vi.fn() },
    });

    const createElement = vi.spyOn(document, 'createElement');
    source.start();
    channel.binaryCallback?.(frame());
    const decoder = createElement.mock.results[
      createElement.mock.calls.findIndex((call) => call[0] === 'video')
    ].value as HTMLVideoElement;
    decoder.dispatchEvent(new Event('loadeddata'));

    expect(createElement).toHaveBeenCalledWith('video');
    expect(createElement).toHaveBeenCalledWith('canvas');
    createElement.mockRestore();
  });
});
