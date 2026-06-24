import { describe, expect, it } from 'vitest';

import { getTechnologyForVideoRTC } from '../../../../src/components-lib/live/utils/get-technology-for-video-rtc';
import type { VideoRTC } from '../../../../src/components/live/providers/go2rtc/video-rtc';
import { createLitElement } from '../../../test-utils';

// @vitest-environment jsdom
describe('getTechnologyForVideoRTC', () => {
  it('webrtc', () => {
    const element = createLitElement() as unknown as VideoRTC;
    element.pc = {} as unknown as RTCPeerConnection;
    expect(getTechnologyForVideoRTC(element)).toEqual(['webrtc']);
  });

  it('mse', () => {
    const element = createLitElement() as unknown as VideoRTC;
    element.mseCodecs = 'mp4a';
    expect(getTechnologyForVideoRTC(element)).toEqual(['mse', 'hls']);
  });

  it('other', () => {
    const element = createLitElement() as unknown as VideoRTC;
    expect(getTechnologyForVideoRTC(element)).toBeUndefined();
  });
});
