import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MP4StreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mp4';
import type {
  ImageStreamTarget,
  StreamSourceContext,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { flushPromises } from '../../../../../test-utils';
import { FakeStreamSourceChannel } from '../test-utils';

class FakeCanvasContext {
  public drawImage = vi.fn();
}

class FakeCanvas {
  public width = 0;
  public height = 0;
  public context: FakeCanvasContext | null = new FakeCanvasContext();
  public getContext = vi.fn(() => this.context);
  public toBlob = vi.fn((callback: (blob: Blob | null) => void) =>
    callback(new Blob(['frame'], { type: 'image/jpeg' })),
  );

  public asCanvas(): HTMLCanvasElement {
    return this as unknown as HTMLCanvasElement;
  }
}

// @vitest-environment jsdom
describe('MP4StreamSource', () => {
  const setup = () => {
    const channel = new FakeStreamSourceChannel();
    const loadedCallback = vi.fn();
    const failedCallback = vi.fn();
    const showFrame = vi.fn<[Blob], Promise<void>>(() => Promise.resolve());
    const context: StreamSourceContext<ImageStreamTarget> = {
      target: { kind: 'image', showFrame },
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
      showFrame,
      source,
    };
  };

  const frame = (): ArrayBuffer => new TextEncoder().encode('Hi').buffer;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('should draw a decoded frame and show it as an image', async () => {
    const { source, channel, decoderVideo, canvas, showFrame, loadedCallback } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    decoderVideo.dispatchEvent(new Event('loadeddata'));
    await flushPromises();

    expect(canvas.context?.drawImage).toBeCalled();
    expect(showFrame).toBeCalledTimes(1);
    const shown = showFrame.mock.calls[0][0] as Blob;
    expect(shown).toBeInstanceOf(Blob);
    expect(shown.type).toBe('image/jpeg');
    expect(loadedCallback).toBeCalledTimes(1);
  });

  it('should report loaded only on the first drawn frame', async () => {
    const { source, channel, decoderVideo, loadedCallback } = setup();
    source.start();

    channel.binaryCallback?.(frame());

    decoderVideo.dispatchEvent(new Event('loadeddata'));
    decoderVideo.dispatchEvent(new Event('loadeddata'));
    await flushPromises();

    expect(loadedCallback).toBeCalledTimes(1);
  });

  it('should not show a frame when the canvas produces no blob', () => {
    const { source, channel, decoderVideo, canvas, showFrame } = setup();
    canvas.toBlob = vi.fn((callback: (blob: Blob | null) => void) => callback(null));
    source.start();
    channel.binaryCallback?.(frame());
    decoderVideo.dispatchEvent(new Event('loadeddata'));

    expect(showFrame).not.toBeCalled();
  });

  it('should do nothing when the canvas has no 2d context', () => {
    const { source, channel, decoderVideo, canvas, showFrame } = setup();
    canvas.context = null;
    source.start();
    channel.binaryCallback?.(frame());
    decoderVideo.dispatchEvent(new Event('loadeddata'));

    expect(showFrame).not.toBeCalled();
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

  it('should not show a frame decoded after stop', () => {
    const { source, channel, decoderVideo, showFrame } = setup();
    source.start();
    channel.binaryCallback?.(frame());
    source.stop();

    // A frame whose decode completes after stop() must not reach the image
    // surface.
    decoderVideo.dispatchEvent(new Event('loadeddata'));

    expect(showFrame).not.toBeCalled();
  });

  describe('first-frame timeout', () => {
    it('should fail when no frame arrives within the timeout', () => {
      const { source, failedCallback } = setup();
      source.start();
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).toBeCalledWith('connect_timeout');
    });

    it('should not fail once a frame has been drawn', () => {
      const { source, channel, decoderVideo, failedCallback } = setup();
      source.start();
      channel.binaryCallback?.(frame());
      decoderVideo.dispatchEvent(new Event('loadeddata'));
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toBeCalled();
    });

    it('should not fail after stop', () => {
      const { source, failedCallback } = setup();
      source.start();
      source.stop();
      vi.advanceTimersByTime(5 * 1000);

      expect(failedCallback).not.toBeCalled();
    });
  });

  it('should report mp4 technology', () => {
    const { source } = setup();

    expect(source.getTechnology()).toEqual(['mp4']);
  });

  it('should default to document element factories when none are injected', () => {
    const channel = new FakeStreamSourceChannel();
    const source = new MP4StreamSource({
      target: { kind: 'image', showFrame: vi.fn() },
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
