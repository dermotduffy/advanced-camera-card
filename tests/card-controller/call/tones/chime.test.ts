// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChimeTone } from '../../../../src/card-controller/call/tones/chime';
import { useAudioMocks } from './test-utils';

const audio = useAudioMocks();

// Each strike emits a 3-layer bell stack in the order: sparkle (one octave
// above the fundamental), fundamental, hum (one octave below). The frequencies
// here are the per-layer values derived from each strike's fundamental.
describe('ChimeTone', () => {
  it('should play DING (Eb5) then DOOOOONG (B4) 0.5s later', () => {
    new ChimeTone(0).start();

    // 2 strikes × 3 layers = 6 oscillators.
    expect(audio.oscillators).toHaveLength(6);

    // DING -- Eb5 (622.25Hz) at t=0.
    expect(audio.oscillators[0].frequency.value).toBe(622.25 * 2);
    expect(audio.oscillators[1].frequency.value).toBe(622.25);
    expect(audio.oscillators[2].frequency.value).toBe(622.25 / 2);
    expect(audio.oscillators[0].start).toBeCalledWith(0);
    expect(audio.oscillators[1].start).toBeCalledWith(0);
    expect(audio.oscillators[2].start).toBeCalledWith(0);

    // DOOOOONG -- B4 (493.88Hz) at t=0.5.
    expect(audio.oscillators[3].frequency.value).toBe(493.88 * 2);
    expect(audio.oscillators[4].frequency.value).toBe(493.88);
    expect(audio.oscillators[5].frequency.value).toBe(493.88 / 2);
    expect(audio.oscillators[3].start).toBeCalledWith(0.5);
    expect(audio.oscillators[4].start).toBeCalledWith(0.5);
    expect(audio.oscillators[5].start).toBeCalledWith(0.5);
  });

  it('should give DING a brighter, shorter bell envelope', () => {
    new ChimeTone(0).start();

    // Sparkle / fundamental / hum peaks for DING.
    expect(audio.gainParams[0].linearRampToValueAtTime).toBeCalledWith(0.1, 0.005);
    expect(audio.gainParams[1].linearRampToValueAtTime).toBeCalledWith(0.22, 0.005);
    expect(audio.gainParams[2].linearRampToValueAtTime).toBeCalledWith(0.08, 0.005);
    // Decay constants (sparkle fades fastest, hum lingers).
    expect(audio.gainParams[0].setTargetAtTime).toBeCalledWith(0, 0.005, 0.3);
    expect(audio.gainParams[1].setTargetAtTime).toBeCalledWith(0, 0.005, 0.8);
    expect(audio.gainParams[2].setTargetAtTime).toBeCalledWith(0, 0.005, 1.2);
  });

  it('should give DOOOOONG a fuller, longer bell envelope', () => {
    new ChimeTone(0).start();

    expect(audio.gainParams[3].linearRampToValueAtTime).toBeCalledWith(0.11, 0.505);
    expect(audio.gainParams[4].linearRampToValueAtTime).toBeCalledWith(0.28, 0.505);
    expect(audio.gainParams[5].linearRampToValueAtTime).toBeCalledWith(0.1, 0.505);
    expect(audio.gainParams[3].setTargetAtTime).toBeCalledWith(0, 0.505, 0.5);
    expect(audio.gainParams[4].setTargetAtTime).toBeCalledWith(0, 0.505, 1.3);
    expect(audio.gainParams[5].setTargetAtTime).toBeCalledWith(0, 0.505, 1.8);
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should schedule the next iteration 5 seconds after a strike pair', () => {
      new ChimeTone(0).start();
      expect(audio.oscillators).toHaveLength(6);

      vi.advanceTimersByTime(5_000);

      // A second iteration ran, producing another 6 oscillators.
      expect(audio.oscillators).toHaveLength(12);
    });
  });
});
