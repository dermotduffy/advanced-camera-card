import { describe, expect, it } from 'vitest';

import { sdpHasH265 } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/webrtc-sdp';

describe('sdpHasH265', () => {
  it('should detect an H.265 rtpmap', () => {
    expect(sdpHasH265('a=rtpmap:98 H265/90000\r\n')).toBe(true);
  });

  it('should return false without an H.265 rtpmap', () => {
    expect(sdpHasH265('a=rtpmap:96 H264/90000\r\n')).toBe(false);
  });
});
