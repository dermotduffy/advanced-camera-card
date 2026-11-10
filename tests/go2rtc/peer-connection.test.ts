import { describe, expect, it } from 'vitest';

import { GO2RTC_PEER_CONNECTION_CONFIG } from '../../src/go2rtc/peer-connection';

describe('peer-connection', () => {
  it('should configure two STUN servers with max-bundle', () => {
    expect(GO2RTC_PEER_CONNECTION_CONFIG).toEqual({
      bundlePolicy: 'max-bundle',
      iceServers: [
        {
          urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
        },
      ],
    });
  });
});
