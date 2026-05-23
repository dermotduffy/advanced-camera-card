// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { ArpeggioTone } from '../../../../src/card-controller/call/tones/arpeggio';
import { useAudioMocks } from './test-utils';

// Each strike emits a 3-layer bell stack in order: sparkle (octave above
// fundamental), fundamental, hum (octave below). Indices into
// `audio.oscillators` step through the three descending plucks.
describe('ArpeggioTone', () => {
  const audio = useAudioMocks();

  it('should play G5-E5-C5 descending plucks 0.25s apart', () => {
    new ArpeggioTone(0).start();

    // 3 strikes × 3 layers = 9 oscillators.
    expect(audio.oscillators).toHaveLength(9);

    // G5 (783.99) at t=0.
    expect(audio.oscillators[1].frequency.value).toBe(783.99);
    expect(audio.oscillators[1].start).toBeCalledWith(0);

    // E5 (659.25) at t=0.25.
    expect(audio.oscillators[4].frequency.value).toBe(659.25);
    expect(audio.oscillators[4].start).toBeCalledWith(0.25);

    // C5 (523.25) at t=0.5.
    expect(audio.oscillators[7].frequency.value).toBe(523.25);
    expect(audio.oscillators[7].start).toBeCalledWith(0.5);
  });

  it('should use the lighter PLUCK envelope for every strike', () => {
    new ArpeggioTone(0).start();

    // Sparkle / fundamental / hum peaks for every strike.
    for (let strike = 0; strike < 3; strike++) {
      const i = strike * 3;
      expect(audio.gainParams[i].linearRampToValueAtTime).toBeCalledWith(
        0.05,
        expect.any(Number),
      );
      expect(audio.gainParams[i + 1].linearRampToValueAtTime).toBeCalledWith(
        0.13,
        expect.any(Number),
      );
      expect(audio.gainParams[i + 2].linearRampToValueAtTime).toBeCalledWith(
        0.04,
        expect.any(Number),
      );
    }
  });
});
