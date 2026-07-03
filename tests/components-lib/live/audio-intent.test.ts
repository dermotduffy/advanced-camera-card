import { describe, expect, it } from 'vitest';

import { isAudioIntendedOnLoad } from '../../../src/components-lib/live/audio-intent';

describe('isAudioIntendedOnLoad', () => {
  it('should return false when no conditions are set', () => {
    expect(isAudioIntendedOnLoad([])).toBe(false);
  });

  it('should return false for the default microphone and call conditions', () => {
    expect(isAudioIntendedOnLoad(['microphone', 'call'])).toBe(false);
  });

  it('should return true when selected is a condition', () => {
    expect(isAudioIntendedOnLoad(['selected'])).toBe(true);
  });

  it('should return true when visible is a condition', () => {
    expect(isAudioIntendedOnLoad(['visible'])).toBe(true);
  });

  it('should return true when a positive condition is combined with others', () => {
    expect(isAudioIntendedOnLoad(['call', 'visible'])).toBe(true);
  });
});
