// A GOP ("group of pictures") is the span from one keyframe to just before the
// next: a full keyframe followed by the smaller frames that only encode what
// changed since it. Streamed video arrives one GOP at a time, so a camera with
// a 2s keyframe interval delivers media in roughly 2s bursts. That cadence sets
// how far behind the live edge playback must sit to ride over the bursts
// without starving, so this file estimates the GOP length by timing the
// wall-clock interval between buffer advances (each advance is about one GOP of
// new media) and averaging it over a short rolling window.
//
// Measuring, rather than assuming a fixed length, is necessary here: the stream
// carries no declared GOP length (it's raw fragments arriving over a
// WebSocket), and camera GOPs vary widely -- a doorbell at ~1s, an NVR tuned
// for bandwidth at 4s+ -- so any single constant is either too small (high-GOP
// cameras stall) or needlessly laggy for everyone else. Measuring per stream
// right-sizes it without a configuration knob.
//
// This is necessary to adaptively calculate the buffer (and thus inflicted
// latency) to maintain for Safari, in order to avoid it "hitting the end" and
// thus pausing, requiring human intervention to play again.

// The assumed GOP length (seconds) until enough delivery cadence is measured,
// and how many recent cadence samples the rolling average spans.
const DEFAULT_GOP_SECONDS = 1;
export const GOP_SAMPLE_WINDOW_SIZE = 5;

// Estimates the GOP length (the delivery cadence) as a rolling average of the
// interval between buffer advances. A trim updates the buffer without growing
// it, so only advances are sampled.
export class GOPCadenceEstimator {
  private _samples: number[] = [];
  private _lastBufferedEnd: number | null = null;
  private _lastAdvanceTime: Date | null = null;

  public sample(bufferedEndSeconds: number, now: Date): void {
    const advanced =
      this._lastBufferedEnd === null || bufferedEndSeconds > this._lastBufferedEnd;
    if (!advanced) {
      return;
    }

    if (this._lastAdvanceTime !== null) {
      const interval = (now.getTime() - this._lastAdvanceTime.getTime()) / 1000;
      if (interval > 0) {
        if (this._samples.length >= GOP_SAMPLE_WINDOW_SIZE) {
          this._samples.shift();
        }
        this._samples.push(interval);
      }
    }

    this._lastAdvanceTime = now;
    this._lastBufferedEnd = bufferedEndSeconds;
  }

  public estimateSeconds(): number {
    if (!this._samples.length) {
      return DEFAULT_GOP_SECONDS;
    }
    return this._samples.reduce((sum, sample) => sum + sample, 0) / this._samples.length;
  }
}
