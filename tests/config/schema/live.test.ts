import { describe, expect, it } from 'vitest';

import { liveConfigSchema } from '../../../src/config/schema/live';

describe('liveConfigSchema microphone constraints', () => {
  it('should preserve existing microphone defaults', () => {
    expect(liveConfigSchema.parse({}).microphone).toEqual({
      always_connected: false,
      auto_mute: [],
      auto_unmute: [],
      mute_after_microphone_mute_seconds: 60,
    });
  });

  it('should parse microphone constraints', () => {
    expect(
      liveConfigSchema.parse({
        microphone: {
          constraints: {
            echo_cancellation: true,
            noise_suppression: false,
            auto_gain_control: false,
            channel_count: 1,
          },
        },
      }).microphone.constraints,
    ).toEqual({
      echo_cancellation: true,
      noise_suppression: false,
      auto_gain_control: false,
      channel_count: 1,
    });
  });

  it.each([0, -1, 1.5])('should reject channel count %s', (channelCount) => {
    expect(() =>
      liveConfigSchema.parse({
        microphone: {
          constraints: {
            channel_count: channelCount,
          },
        },
      }),
    ).toThrow();
  });
});
