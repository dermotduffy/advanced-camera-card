import { GeneratedTone } from './base';

// A short melodic phrase: a I-V-I cadence in C major. Three triads played in
// sequence with a bell envelope -- each chord rings as the next begins, so
// the harmonies blend briefly before resolving home an octave higher. Each
// chord is framed bell-stack style with a sparkle an octave above the
// highest note and a hum an octave below the lowest, while the chord notes
// themselves are the fundamentals.
export class MelodyTone extends GeneratedTone {
  protected _play(): void {
    const t0 = this._currentTime;

    // I -- C major: C5 + E5 + G5 (root C, sparkle G6, hum C4).
    this._strike([523.25, 659.25, 783.99], 1567.98, 261.63, t0 + 0.0);
    // V -- G major: G4 + B4 + D5 (root G, sparkle D6, hum G3).
    this._strike([392.0, 493.88, 587.33], 1174.66, 196.0, t0 + 1.0);
    // I -- C major higher: E5 + G5 + C6 (sparkle C7, hum E4), longer tail.
    this._strike([659.25, 783.99, 1046.5], 2093.0, 329.63, t0 + 2.0, {
      fundDecay: 0.9,
      humDecay: 1.4,
    });

    this._scheduleNext(6);
  }

  private _strike(
    chordFreqs: number[],
    sparkleFreq: number,
    humFreq: number,
    when: number,
    options?: { fundDecay?: number; humDecay?: number },
  ): void {
    const fundDecay = options?.fundDecay ?? 0.6;
    const humDecay = options?.humDecay ?? 1.1;
    this._playNote(sparkleFreq, when, {
      peak: 0.05,
      attack: 0.005,
      decayTau: 0.4,
      hold: 1.6,
    });
    for (const freq of chordFreqs) {
      this._playNote(freq, when, {
        peak: 0.1,
        attack: 0.005,
        decayTau: fundDecay,
        hold: fundDecay * 4,
      });
    }
    this._playNote(humFreq, when, {
      peak: 0.05,
      attack: 0.005,
      decayTau: humDecay,
      hold: humDecay * 3,
    });
  }
}
