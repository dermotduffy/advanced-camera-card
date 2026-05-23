import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChimeTone } from '../../../../src/card-controller/call/tones/chime';
import { useAudioMocks } from './test-utils';

// `GeneratedTone` is abstract; its shared machinery (AudioContext lifecycle,
// repeat-counter scheduling, stop-suppresses-finishedHandler) is exercised
// through a real concrete subclass. `ChimeTone` is the chosen vehicle: it
// produces a deterministic 6-oscillator iteration (2 strikes × 3 bell-stack
// layers) and loops every 5 seconds, giving stable counts to assert on.
const ITERATION_OSCILLATORS = 6;
const ITERATION_INTERVAL_MS = 5_000;

const audio = useAudioMocks();

// @vitest-environment jsdom
describe('start', () => {
  it('should construct an AudioContext and play one iteration', () => {
    new ChimeTone(0).start();

    expect(audio.audioContextCtor).toBeCalledTimes(1);
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS);
  });

  it('should no-op when called twice without stop', () => {
    const tone = new ChimeTone(0);

    tone.start();
    tone.start();

    expect(audio.audioContextCtor).toBeCalledTimes(1);
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS);
  });

  it('should fire finishedHandler when AudioContext construction throws', () => {
    audio.audioContextCtor.mockImplementation(() => {
      throw new Error('unsupported');
    });
    const onFinished = vi.fn();

    new ChimeTone(0).start(onFinished);

    expect(onFinished).toBeCalled();
    expect(audio.oscillators).toHaveLength(0);
  });
});

describe('stop', () => {
  it('should close the AudioContext', () => {
    const tone = new ChimeTone(0);
    tone.start();

    tone.stop();

    expect(audio.audioContext.close).toBeCalled();
  });

  it('should not fire finishedHandler on external stop', () => {
    const tone = new ChimeTone(0);
    const onFinished = vi.fn();
    tone.start(onFinished);

    tone.stop();

    expect(onFinished).not.toBeCalled();
  });

  it('should swallow AudioContext.close rejections silently', () => {
    vi.mocked(audio.audioContext.close).mockRejectedValue(new Error('already-closed'));
    const tone = new ChimeTone(0);
    tone.start();

    expect(() => tone.stop()).not.toThrow();
  });
});

describe('repeat counter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should loop indefinitely when repeat is 0', () => {
    new ChimeTone(0).start();
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS);

    for (let i = 2; i <= 5; i++) {
      vi.advanceTimersByTime(ITERATION_INTERVAL_MS);
      expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS * i);
    }
    expect(audio.audioContext.close).not.toBeCalled();
  });

  it('should play exactly `repeat` iterations and then finish', () => {
    const onFinished = vi.fn();

    new ChimeTone(3).start(onFinished);
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS);

    vi.advanceTimersByTime(ITERATION_INTERVAL_MS);
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS * 2);

    vi.advanceTimersByTime(ITERATION_INTERVAL_MS);
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS * 3);

    // After the third iteration the next timer waits one interval for the
    // decay tail, then fires the finished handler and stops.
    vi.advanceTimersByTime(ITERATION_INTERVAL_MS);
    expect(audio.oscillators).toHaveLength(ITERATION_OSCILLATORS * 3);
    expect(onFinished).toBeCalledTimes(1);
    expect(audio.audioContext.close).toBeCalled();
  });

  it('should not fire finishedHandler when stopped mid-sequence', () => {
    const tone = new ChimeTone(5);
    const onFinished = vi.fn();

    tone.start(onFinished);
    vi.advanceTimersByTime(ITERATION_INTERVAL_MS);
    tone.stop();
    // Even if any stale scheduled work fires, finishedHandler stays silent.
    vi.advanceTimersByTime(ITERATION_INTERVAL_MS * 10);

    expect(onFinished).not.toBeCalled();
  });
});
