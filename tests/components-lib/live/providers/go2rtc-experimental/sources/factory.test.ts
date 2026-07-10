import { describe, expect, it, vi } from 'vitest';

import {
  createBinarySource,
  createWebRTCSource,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/factory';
import { MJPEGStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mjpeg';
import { MP4StreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mp4';
import { MSEStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/mse';
import { WebRTCStreamSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/sources/webrtc';
import type { StreamSourceContext } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { FakeStreamSourceChannel } from '../test-utils';

const createContext = (): StreamSourceContext => ({
  video: document.createElement('video'),
  channel: new FakeStreamSourceChannel(),
  callbacks: { loadedCallback: vi.fn(), failedCallback: vi.fn() },
});

// @vitest-environment jsdom
describe('createBinarySource', () => {
  it('should create an MSE source', () => {
    expect(createBinarySource('mse', createContext())).toBeInstanceOf(MSEStreamSource);
  });

  it('should create an MP4 source', () => {
    expect(createBinarySource('mp4', createContext())).toBeInstanceOf(MP4StreamSource);
  });

  it('should create an MJPEG source', () => {
    expect(createBinarySource('mjpeg', createContext())).toBeInstanceOf(
      MJPEGStreamSource,
    );
  });

  it('should return null for the webrtc mode', () => {
    // WebRTC is not a binary source; it is created via createWebRTCSource.
    expect(createBinarySource('webrtc', createContext())).toBeNull();
  });
});

describe('createWebRTCSource', () => {
  it('should create a WebRTC source', () => {
    expect(createWebRTCSource(createContext())).toBeInstanceOf(WebRTCStreamSource);
  });
});
