import { BellTone } from './bell';

// Westminster Quarters: the classic clock-tower four-note phrase
// (E5 - D5 - C5 - G4), played slow legato so each note rings into the next.
// The final G4 gets a longer tail to resolve the phrase.
export class WestminsterTone extends BellTone {
  protected _play(): void {
    const t0 = this._currentTime;
    this._strike(659.25, t0 + 0.0); // E5
    this._strike(587.33, t0 + 0.55); // D5
    this._strike(523.25, t0 + 1.1); // C5
    this._strike(392.0, t0 + 1.65, { fundDecay: 0.9, humDecay: 1.4 }); // G4, longer tail
    this._scheduleNext(5);
  }
}
