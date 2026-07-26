import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Ringtone } from '../../../src/card-controller/call/ringtone';
import { ArpeggioTone } from '../../../src/card-controller/call/tones/arpeggio';
import { ChimeTone } from '../../../src/card-controller/call/tones/chime';
import { CustomTone } from '../../../src/card-controller/call/tones/custom';
import { MelodyTone } from '../../../src/card-controller/call/tones/melody';
import { WestminsterTone } from '../../../src/card-controller/call/tones/westminster';
import type { RingtoneConfig } from '../../../src/config/schema/live';

// Each tone constructor returns a fresh `mock<>()` per `new` call; the mock
// implementation persists across `vi.clearAllMocks()` (which only clears call
// records, not implementations) so tests don't need per-test re-installation.
vi.mock('../../../src/card-controller/call/tones/chime', () => ({
  ChimeTone: vi.fn().mockImplementation(() => mock<ChimeTone>()),
}));
vi.mock('../../../src/card-controller/call/tones/westminster', () => ({
  WestminsterTone: vi.fn().mockImplementation(() => mock<WestminsterTone>()),
}));
vi.mock('../../../src/card-controller/call/tones/arpeggio', () => ({
  ArpeggioTone: vi.fn().mockImplementation(() => mock<ArpeggioTone>()),
}));
vi.mock('../../../src/card-controller/call/tones/melody', () => ({
  MelodyTone: vi.fn().mockImplementation(() => mock<MelodyTone>()),
}));
vi.mock('../../../src/card-controller/call/tones/custom', () => ({
  CustomTone: vi.fn().mockImplementation(() => mock<CustomTone>()),
}));

// Returns the most recently constructed instance of a mocked class.
const lastInstance = <T>(ctor: { mock: { results: { value: T }[] } }): T => {
  const result = ctor.mock.results.at(-1);
  if (!result) {
    throw new Error('No mocked instance has been constructed yet');
  }
  return result.value;
};

const chimeConfig: RingtoneConfig = { type: 'chime', repeat: 0 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('factory dispatch', () => {
  it('should construct a ChimeTone for type "chime"', () => {
    new Ringtone(new Set()).start({ type: 'chime', repeat: 3 });

    expect(ChimeTone).toBeCalledWith(3);
  });

  it('should construct a WestminsterTone for type "westminster"', () => {
    new Ringtone(new Set()).start({ type: 'westminster', repeat: 2 });

    expect(WestminsterTone).toBeCalledWith(2);
  });

  it('should construct an ArpeggioTone for type "arpeggio"', () => {
    new Ringtone(new Set()).start({ type: 'arpeggio', repeat: 1 });

    expect(ArpeggioTone).toBeCalledWith(1);
  });

  it('should construct a MelodyTone for type "melody"', () => {
    new Ringtone(new Set()).start({ type: 'melody', repeat: 5 });

    expect(MelodyTone).toBeCalledWith(5);
  });

  it('should construct a CustomTone for type "custom" with a URL', () => {
    new Ringtone(new Set()).start({
      type: 'custom',
      url: 'http://localhost/ring.mp3',
      repeat: 0,
    });

    expect(CustomTone).toBeCalledWith('http://localhost/ring.mp3', 0);
  });

  it('should construct no tone for type "custom" without a URL', () => {
    const ringtone = new Ringtone(new Set());

    ringtone.start({ type: 'custom', repeat: 0 });

    expect(CustomTone).not.toBeCalled();
    expect(ringtone.isPlaying()).toBe(false);
  });

  it('should construct no tone for type "none"', () => {
    const ringtone = new Ringtone(new Set());

    ringtone.start({ type: 'none', repeat: 0 });

    expect(ChimeTone).not.toBeCalled();
    expect(ringtone.isPlaying()).toBe(false);
  });
});

describe('start', () => {
  it('should start the tone and report playing', () => {
    const ringtone = new Ringtone(new Set());

    ringtone.start(chimeConfig);

    expect(lastInstance(vi.mocked(ChimeTone)).start).toBeCalled();
    expect(ringtone.isPlaying()).toBe(true);
  });

  it('should no-op when already playing', () => {
    const ringtone = new Ringtone(new Set());

    ringtone.start(chimeConfig);
    ringtone.start(chimeConfig);

    expect(ChimeTone).toBeCalledTimes(1);
    expect(lastInstance(vi.mocked(ChimeTone)).start).toBeCalledTimes(1);
  });

  it('should claim the lock when a tone starts', () => {
    const lock = new Set<Ringtone>();
    const ringtone = new Ringtone(lock);

    ringtone.start(chimeConfig);

    expect(lock.has(ringtone)).toBe(true);
  });

  it('should not claim the lock when no tone is created', () => {
    const lock = new Set<Ringtone>();
    const ringtone = new Ringtone(lock);

    ringtone.start({ type: 'none', repeat: 0 });

    expect(lock.size).toBe(0);
  });
});

describe('lock', () => {
  it('should refuse to start when another ringtone holds the lock', () => {
    const lock = new Set<Ringtone>();
    const first = new Ringtone(lock);
    const second = new Ringtone(lock);

    first.start(chimeConfig);
    vi.mocked(ChimeTone).mockClear();
    second.start(chimeConfig);

    expect(ChimeTone).not.toBeCalled();
    expect(second.isPlaying()).toBe(false);
    expect(first.isPlaying()).toBe(true);
  });

  it('should release the lock on stop so a peer can start', () => {
    const lock = new Set<Ringtone>();
    const first = new Ringtone(lock);
    const second = new Ringtone(lock);

    first.start(chimeConfig);
    const firstTone = lastInstance(vi.mocked(ChimeTone));
    first.stop();
    expect(firstTone.stop).toBeCalled();

    second.start(chimeConfig);

    expect(lastInstance(vi.mocked(ChimeTone)).start).toBeCalled();
    expect(second.isPlaying()).toBe(true);
  });

  it('should sweep stale holders whose tone never released the lock', () => {
    const lock = new Set<Ringtone>();
    const stale = new Ringtone(lock);

    // Simulate a stale entry: a holder that says it's no longer playing but
    // is still in the lock set (e.g. controller GC'd without disconnect).
    lock.add(stale);
    expect(stale.isPlaying()).toBe(false);

    const fresh = new Ringtone(lock);
    fresh.start(chimeConfig);

    expect(lock.has(stale)).toBe(false);
    expect(fresh.isPlaying()).toBe(true);
  });
});

describe('natural finish', () => {
  it('should release the lock when the tone fires its finished handler', () => {
    let finishedHandler: (() => void) | undefined;
    vi.mocked(ChimeTone).mockImplementationOnce(() => {
      const tone = mock<ChimeTone>();
      vi.mocked(tone.start).mockImplementation((handler) => {
        finishedHandler = handler;
      });
      return tone;
    });
    const lock = new Set<Ringtone>();
    const ringtone = new Ringtone(lock);

    ringtone.start(chimeConfig);
    expect(lock.has(ringtone)).toBe(true);

    finishedHandler?.();

    expect(lock.has(ringtone)).toBe(false);
    expect(ringtone.isPlaying()).toBe(false);
  });
});

describe('stop', () => {
  it('should release the lock and stop the tone', () => {
    const lock = new Set<Ringtone>();
    const ringtone = new Ringtone(lock);

    ringtone.start(chimeConfig);
    ringtone.stop();

    expect(lastInstance(vi.mocked(ChimeTone)).stop).toBeCalled();
    expect(lock.has(ringtone)).toBe(false);
    expect(ringtone.isPlaying()).toBe(false);
  });

  it('should be safe when called without a prior start', () => {
    const ringtone = new Ringtone(new Set());

    expect(() => ringtone.stop()).not.toThrow();
  });
});

describe('default lock', () => {
  it('should default to the module-level lock when no lock is provided', () => {
    // Two ringtones constructed with no args share the module-level lock, so
    // the second must refuse to play while the first holds it.
    const first = new Ringtone();
    const second = new Ringtone();
    first.start(chimeConfig);

    vi.mocked(ChimeTone).mockClear();
    second.start(chimeConfig);

    expect(ChimeTone).not.toBeCalled();
    first.stop();
  });
});
