export type RingtoneFinishedHandler = () => void;

// A playable inbound-call notification sound. Implementations may loop a
// generated pattern, play a single file, or do nothing -- `start()` is the only
// entry point and `stop()` halts whatever is in flight.
export interface Tone {
  // Handler is called once when a tone exhausts its configured play count
  // naturally (i.e. completes the last iteration's audible tail). Does NOT fire
  // when `stop()` is invoked externally -- so callers can distinguish "tone
  // finished playing" from "we asked it to stop".
  start(finishedHandler?: RingtoneFinishedHandler): void;
  stop(): void;
}

// A single note's volume shape over time: rises to `peak` over `attack`
// seconds, then fades. `decayTau` controls the fade speed (smaller = faster).
// `hold` sets the note's total duration -- pick a value large enough for the
// fade to be inaudible by the end.
export interface ToneEnvelope {
  peak: number;
  attack: number;
  decayTau: number;
  hold: number;
}
