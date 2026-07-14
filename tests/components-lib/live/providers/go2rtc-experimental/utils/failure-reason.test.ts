import { describe, expect, it } from 'vitest';

import { mapFailureReasonToIssueReason } from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/failure-reason';

describe('mapFailureReasonToIssueReason', () => {
  it.each([
    ['connect_timeout', 'not_loading'],
    ['negotiation_timeout', 'not_loading'],
    ['media_error', 'playback_error'],
    ['buffer_overflow', 'playback_error'],
    ['two_way_audio_error', 'two_way_audio_error'],
    ['server_error', 'server_error'],
    ['unsupported', 'unsupported'],
  ] as const)('should map %s to the %s cause', (reason, expected) => {
    expect(mapFailureReasonToIssueReason(reason)).toBe(expected);
  });

  it('should map a null reason to a generic playback error', () => {
    expect(mapFailureReasonToIssueReason(null)).toBe('playback_error');
  });
});
