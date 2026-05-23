import { GeneratedTone } from './base';

// Per-layer volume and decay tuning for a single bell strike. All fields are
// optional with sensible defaults; subclasses override only the layers they
// want to tune.
export interface BellStrikeOptions {
  sparklePeak?: number;
  fundPeak?: number;
  humPeak?: number;
  sparkleDecay?: number;
  fundDecay?: number;
  humDecay?: number;
}

// Base for tones whose pattern is a series of single-note bell strikes. Each
// strike stacks a sparkle (one octave above the fundamental), the
// fundamental, and a hum (one octave below), with differential decay --
// sparkle fades fastest, hum lingers -- for the natural bell evolution.
//
// Subclasses define the pattern by calling `_strike(freq, when, options)` at
// the right moments; this base handles the three-layer stacking.
export abstract class BellTone extends GeneratedTone {
  protected _strike(freq: number, when: number, options?: BellStrikeOptions): void {
    const sparklePeak = options?.sparklePeak ?? 0.06;
    const fundPeak = options?.fundPeak ?? 0.14;
    const humPeak = options?.humPeak ?? 0.05;
    const sparkleDecay = options?.sparkleDecay ?? 0.3;
    const fundDecay = options?.fundDecay ?? 0.6;
    const humDecay = options?.humDecay ?? 1.0;

    this._playNote(freq * 2, when, {
      peak: sparklePeak,
      attack: 0.005,
      decayTau: sparkleDecay,
      hold: sparkleDecay * 4,
    });
    this._playNote(freq, when, {
      peak: fundPeak,
      attack: 0.005,
      decayTau: fundDecay,
      hold: fundDecay * 4,
    });
    this._playNote(freq / 2, when, {
      peak: humPeak,
      attack: 0.005,
      decayTau: humDecay,
      hold: humDecay * 3,
    });
  }
}
