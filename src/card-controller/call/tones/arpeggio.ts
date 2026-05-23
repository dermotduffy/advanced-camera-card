import { BellStrikeOptions, BellTone } from './bell';

const PLUCK: BellStrikeOptions = {
  sparklePeak: 0.05,
  fundPeak: 0.13,
  humPeak: 0.04,
  sparkleDecay: 0.15,
  fundDecay: 0.3,
  humDecay: 0.5,
};

// Three quick descending notes -- G5, E5, C5 -- 0.25s apart. Shorter decays
// than the other bell tones since the arpeggio's character is lightness and
// pace.
export class ArpeggioTone extends BellTone {
  protected _play(): void {
    const t0 = this._currentTime;
    this._strike(783.99, t0 + 0.0, PLUCK); // G5
    this._strike(659.25, t0 + 0.25, PLUCK); // E5
    this._strike(523.25, t0 + 0.5, PLUCK); // C5
    this._scheduleNext(3);
  }
}
