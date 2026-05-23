import { BellTone } from './bell';

// A classic doorbell "DING DOOOOONG" -- two strikes, Eb5 down to B4 (a major
// third). Each strike is a bell stack: sparkle one octave above, fundamental,
// hum one octave below, with differential decay (sparkle fades fastest, hum
// lingers).
export class ChimeTone extends BellTone {
  protected _play(): void {
    const t0 = this._currentTime;
    // DING -- Eb5.
    this._strike(622.25, t0, {
      sparklePeak: 0.1,
      fundPeak: 0.22,
      humPeak: 0.08,
      sparkleDecay: 0.3,
      fundDecay: 0.8,
      humDecay: 1.2,
    });
    // DOOOOONG -- B4, louder and longer.
    this._strike(493.88, t0 + 0.5, {
      sparklePeak: 0.11,
      fundPeak: 0.28,
      humPeak: 0.1,
      sparkleDecay: 0.5,
      fundDecay: 1.3,
      humDecay: 1.8,
    });
    this._scheduleNext(5);
  }
}
