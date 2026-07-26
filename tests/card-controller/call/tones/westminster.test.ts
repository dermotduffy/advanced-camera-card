// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { WestminsterTone } from '../../../../src/card-controller/call/tones/westminster';
import { useAudioMocks } from './test-utils';

const audio = useAudioMocks();

// Each strike emits a 3-layer bell stack in order: sparkle (octave above
// fundamental), fundamental, hum (octave below). Indices into
// `audio.oscillators` step through the four strikes of the phrase.
describe('WestminsterTone', () => {
  it('should play the E5-D5-C5-G4 phrase 0.55s apart', () => {
    new WestminsterTone(0).start();

    // 4 strikes × 3 layers = 12 oscillators.
    expect(audio.oscillators).toHaveLength(12);

    // E5 (659.25) at t=0.
    expect(audio.oscillators[1].frequency.value).toBe(659.25);
    expect(audio.oscillators[1].start).toHaveBeenCalledWith(0);

    // D5 (587.33) at t=0.55.
    expect(audio.oscillators[4].frequency.value).toBe(587.33);
    expect(audio.oscillators[4].start).toHaveBeenCalledWith(0.55);

    // C5 (523.25) at t=1.1.
    expect(audio.oscillators[7].frequency.value).toBe(523.25);
    expect(audio.oscillators[7].start).toHaveBeenCalledWith(1.1);

    // G4 (392.0) at t=1.65 -- the resolution.
    expect(audio.oscillators[10].frequency.value).toBe(392.0);
    expect(audio.oscillators[10].start).toHaveBeenCalledWith(1.65);
  });

  it('should give the resolving G4 a longer bell tail than the other strikes', () => {
    new WestminsterTone(0).start();

    // First three strikes use default decay (fundDecay=0.6, humDecay=1.0).
    expect(audio.gainParams[1].setTargetAtTime).toHaveBeenCalledWith(0, 0.005, 0.6);
    expect(audio.gainParams[2].setTargetAtTime).toHaveBeenCalledWith(0, 0.005, 1.0);

    // G4 (final strike) overrides to fundDecay=0.9, humDecay=1.4.
    expect(audio.gainParams[10].setTargetAtTime).toHaveBeenCalledWith(
      0,
      1.65 + 0.005,
      0.9,
    );
    expect(audio.gainParams[11].setTargetAtTime).toHaveBeenCalledWith(
      0,
      1.65 + 0.005,
      1.4,
    );
  });
});
