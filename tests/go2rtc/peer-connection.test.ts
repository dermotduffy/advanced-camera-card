import { describe, expect, it } from 'vitest';

import { GO2RTC_PEER_CONNECTION_CONFIG } from '../../src/go2rtc/peer-connection';

describe('GO2RTC_PEER_CONNECTION_CONFIG', () => {
  it('should bundle every track onto one transport', () => {
    expect(GO2RTC_PEER_CONNECTION_CONFIG).toEqual({ bundlePolicy: 'max-bundle' });
  });
});
