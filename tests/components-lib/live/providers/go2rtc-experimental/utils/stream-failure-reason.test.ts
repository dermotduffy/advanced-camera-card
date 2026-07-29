import { describe, expect, it } from 'vitest';

import { mapStreamFailureReasonToIssueReason } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/stream-failure-reason';

describe('mapStreamFailureReasonToIssueReason', () => {
  it.each([
    ['connect_timeout', 'not_loading'],
    ['negotiation_timeout', 'not_loading'],
    ['media_error', 'playback_error'],
    ['buffer_overflow', 'playback_error'],
    ['server_error', 'server_error'],
    ['unsupported', 'unsupported'],
  ] as const)('should map %s to the %s cause', (reason, expected) => {
    expect(mapStreamFailureReasonToIssueReason(reason)).toBe(expected);
  });

  it('should map a null reason to a generic playback error', () => {
    expect(mapStreamFailureReasonToIssueReason(null)).toBe('playback_error');
  });
});
