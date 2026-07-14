import { describe, expect, it, vi } from 'vitest';

import {
  createBinarySource,
  createWebRTCSource,
  type BinaryStreamTargets,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/factory';
import { MJPEGStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mjpeg';
import { MP4StreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mp4';
import { MSEStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mse';
import { WebRTCStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/webrtc';
import type {
  StreamSourceCallbacks,
  StreamSourceContext,
  VideoStreamTarget,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { FakeStreamSourceChannel } from '../test-utils';

const createTargets = (): BinaryStreamTargets => ({
  video: { kind: 'video', video: document.createElement('video') },
  image: { kind: 'image', showFrame: vi.fn() },
});

const createCallbacks = (): StreamSourceCallbacks => ({
  loadedCallback: vi.fn(),
  failedCallback: vi.fn(),
});

// @vitest-environment jsdom
describe('createBinarySource', () => {
  it('should create an MSE source on the video surface', () => {
    const result = createBinarySource(
      'mse',
      createTargets(),
      new FakeStreamSourceChannel(),
      createCallbacks(),
    );

    expect(result?.source).toBeInstanceOf(MSEStreamSource);
    expect(result?.surface).toBe('video');
  });

  it('should create an MP4 source on the image surface', () => {
    const result = createBinarySource(
      'mp4',
      createTargets(),
      new FakeStreamSourceChannel(),
      createCallbacks(),
    );

    expect(result?.source).toBeInstanceOf(MP4StreamSource);
    expect(result?.surface).toBe('image');
  });

  it('should create an MJPEG source on the image surface', () => {
    const result = createBinarySource(
      'mjpeg',
      createTargets(),
      new FakeStreamSourceChannel(),
      createCallbacks(),
    );

    expect(result?.source).toBeInstanceOf(MJPEGStreamSource);
    expect(result?.surface).toBe('image');
  });

  it('should return null for the webrtc mode', () => {
    // WebRTC is not a binary source; it is created via createWebRTCSource.
    expect(
      createBinarySource(
        'webrtc',
        createTargets(),
        new FakeStreamSourceChannel(),
        createCallbacks(),
      ),
    ).toBeNull();
  });
});

describe('createWebRTCSource', () => {
  it('should create a WebRTC source', () => {
    const context: StreamSourceContext<VideoStreamTarget> = {
      target: { kind: 'video', video: document.createElement('video') },
      channel: new FakeStreamSourceChannel(),
      callbacks: createCallbacks(),
    };

    expect(createWebRTCSource(context)).toBeInstanceOf(WebRTCStreamSource);
  });
});
