// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { MelodyTone } from '../../../../src/card-controller/call/tones/melody';
import { useAudioMocks } from './test-utils';

const audio = useAudioMocks();

// MelodyTone synthesizes each chord as: 1 sparkle (an octave above the
// highest chord note) + 3 chord notes + 1 hum (an octave below the lowest).
// Three chords × 5 notes = 15 oscillators per iteration.
describe('MelodyTone', () => {
  it('should play a I-V-I cadence in C major over 3 seconds', () => {
    new MelodyTone(0).start();

    expect(audio.oscillators).toHaveLength(15);

    // --- I chord (C major) at t=0: sparkle G6, C5 + E5 + G5, hum C4. ---
    expect(audio.oscillators[0].frequency.value).toBe(1567.98);
    expect(audio.oscillators[1].frequency.value).toBe(523.25);
    expect(audio.oscillators[2].frequency.value).toBe(659.25);
    expect(audio.oscillators[3].frequency.value).toBe(783.99);
    expect(audio.oscillators[4].frequency.value).toBe(261.63);
    expect(audio.oscillators[0].start).toBeCalledWith(0);
    expect(audio.oscillators[4].start).toBeCalledWith(0);

    // --- V chord (G major) at t=1: sparkle D6, G4 + B4 + D5, hum G3. ---
    expect(audio.oscillators[5].frequency.value).toBe(1174.66);
    expect(audio.oscillators[6].frequency.value).toBe(392.0);
    expect(audio.oscillators[7].frequency.value).toBe(493.88);
    expect(audio.oscillators[8].frequency.value).toBe(587.33);
    expect(audio.oscillators[9].frequency.value).toBe(196.0);
    expect(audio.oscillators[5].start).toBeCalledWith(1);
    expect(audio.oscillators[9].start).toBeCalledWith(1);

    // --- I chord (resolution, an octave higher) at t=2. ---
    expect(audio.oscillators[10].frequency.value).toBe(2093.0);
    expect(audio.oscillators[11].frequency.value).toBe(659.25);
    expect(audio.oscillators[12].frequency.value).toBe(783.99);
    expect(audio.oscillators[13].frequency.value).toBe(1046.5);
    expect(audio.oscillators[14].frequency.value).toBe(329.63);
    expect(audio.oscillators[10].start).toBeCalledWith(2);
    expect(audio.oscillators[14].start).toBeCalledWith(2);
  });

  it('should give the resolving chord a longer tail than the I and V chords', () => {
    new MelodyTone(0).start();

    // I and V chords use default fundDecay=0.6, humDecay=1.1.
    expect(audio.gainParams[1].setTargetAtTime).toBeCalledWith(0, 0.005, 0.6);
    expect(audio.gainParams[4].setTargetAtTime).toBeCalledWith(0, 0.005, 1.1);
    expect(audio.gainParams[6].setTargetAtTime).toBeCalledWith(0, 1.005, 0.6);
    expect(audio.gainParams[9].setTargetAtTime).toBeCalledWith(0, 1.005, 1.1);

    // Final I chord overrides to fundDecay=0.9, humDecay=1.4.
    expect(audio.gainParams[11].setTargetAtTime).toBeCalledWith(0, 2.005, 0.9);
    expect(audio.gainParams[14].setTargetAtTime).toBeCalledWith(0, 2.005, 1.4);
  });
});
