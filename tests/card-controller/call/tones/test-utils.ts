import { afterEach, beforeEach, Mock, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

// Type-safe Web Audio API mocks for tone tests. The real `GeneratedTone`
// constructs an AudioContext directly; here we stub the global `AudioContext`
// to return a deep-mocked instance whose `createOscillator()` / `createGain()`
// factories return a *fresh* mock per call (not a shared one). This lets tests
// assert against individual notes — e.g. `audio.oscillators[2].frequency.value`
// — instead of having every call write over the same observable state.
interface AudioMocks {
  audioContext: MockProxy<AudioContext>;
  audioContextCtor: Mock<[], MockProxy<AudioContext>>;

  // Filled in the order `createOscillator()` / `createGain()` were called.
  oscillators: MockProxy<OscillatorNode>[];
  gains: MockProxy<GainNode>[];

  // gainParams[i] is the AudioParam exposed by `gains[i].gain` — kept as a
  // parallel array because `mock<GainNode>()` doesn't auto-populate the
  // AudioParam interface as a callable deep mock (we wire it up by hand).
  gainParams: MockProxy<AudioParam>[];
}

// Installs `AudioContext` mock on the global scope and resets it between tests;
// restores real globals afterwards. Returns the live `audio` handle so tests
// can read its fields after each `beforeEach` runs.
//
// Called once at module load. The `beforeEach`/`afterEach` calls inside this
// helper register Vitest hooks at the file level — Vitest picks them up just as
// if they had been written at the top of the file — so every test in the file
// gets fresh mocks installed/torn down automatically.
export const useAudioMocks = (): AudioMocks => {
  const audio = {} as AudioMocks;

  beforeEach(() => {
    audio.audioContext = mock<AudioContext>();
    audio.oscillators = [];
    audio.gains = [];
    audio.gainParams = [];

    vi.mocked(audio.audioContext.createOscillator).mockImplementation(() => {
      const oscillator = mock<OscillatorNode>();
      // `frequency` is a real AudioParam at runtime; the source assigns
      // `oscillator.frequency.value = freq` which must round-trip on read.
      Object.defineProperty(oscillator, 'frequency', {
        value: { value: 0 },
        configurable: true,
      });
      audio.oscillators.push(oscillator);
      return oscillator;
    });

    vi.mocked(audio.audioContext.createGain).mockImplementation(() => {
      const gain = mock<GainNode>();
      const gainParam = mock<AudioParam>();
      Object.defineProperty(gain, 'gain', {
        value: gainParam,
        configurable: true,
      });
      audio.gains.push(gain);
      audio.gainParams.push(gainParam);
      return gain;
    });

    // The source chains `.catch(...)` on the close() Promise.
    vi.mocked(audio.audioContext.close).mockResolvedValue();
    // The base class reads `_currentTime` from this — left as a deep-mock spy
    // by default it'd return a function, so anchor it at 0 for predictable
    // scheduling assertions.
    Object.defineProperty(audio.audioContext, 'currentTime', {
      value: 0,
      configurable: true,
    });

    audio.audioContextCtor = vi.fn(() => audio.audioContext);
    vi.stubGlobal('AudioContext', audio.audioContextCtor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return audio;
};
