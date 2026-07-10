import { describe, expect, it } from 'vitest';

import type { StreamProfile } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import { getPreferredSource } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/source-priority';

const createProfile = (overrides: Partial<StreamProfile>): StreamProfile => ({
  hasVideo: false,
  hasH265Video: false,
  hasAudio: false,
  hasAACAudio: false,
  ...overrides,
});

describe('getPreferredSource', () => {
  it('should prefer WebRTC when both offer equal H.264 video and audio', () => {
    expect(
      getPreferredSource(
        createProfile({ hasVideo: true, hasAudio: true }),
        createProfile({ hasVideo: true, hasAACAudio: true }),
      ),
    ).toBe('webrtc');
  });

  it('should prefer WebRTC H.265 over binary-source H.265', () => {
    expect(
      getPreferredSource(
        createProfile({ hasVideo: true, hasH265Video: true }),
        createProfile({ hasVideo: true, hasH265Video: true }),
      ),
    ).toBe('webrtc');
  });

  it('should prefer binary-source H.265 with audio over WebRTC H.264 with audio', () => {
    expect(
      getPreferredSource(
        createProfile({ hasVideo: true, hasAudio: true }),
        createProfile({ hasVideo: true, hasH265Video: true, hasAACAudio: true }),
      ),
    ).toBe('binary');
  });

  it('should prefer WebRTC when the binary source has no media', () => {
    expect(
      getPreferredSource(createProfile({ hasVideo: true }), createProfile({})),
    ).toBe('webrtc');
  });

  it('should prefer the binary source when WebRTC has no video', () => {
    expect(
      getPreferredSource(
        createProfile({ hasAudio: true }),
        createProfile({ hasVideo: true }),
      ),
    ).toBe('binary');
  });

  it('should prefer the stream with audio when video is otherwise equal', () => {
    expect(
      getPreferredSource(
        createProfile({ hasVideo: true }),
        createProfile({ hasVideo: true, hasAACAudio: true }),
      ),
    ).toBe('binary');
  });

  it('should not count non-AAC MSE audio', () => {
    // MSE opus audio (hasAudio true, hasAACAudio false) does not raise the
    // binary-side score, so WebRTC video wins.
    expect(
      getPreferredSource(
        createProfile({ hasVideo: true }),
        createProfile({ hasVideo: true, hasAudio: true }),
      ),
    ).toBe('webrtc');
  });
});
