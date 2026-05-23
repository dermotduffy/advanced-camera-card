import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { CustomTone } from '../../../../src/card-controller/call/tones/custom';

interface AudioMocks {
  // Each call to `new Audio(...)` is delegated to a real jsdom Audio element
  // and pushed here in construction order, so tests can dispatch real events
  // and read real properties (`loop`, `currentTime`, etc.) on the instances.
  instances: HTMLAudioElement[];
  ctor: Mock<[string?], HTMLAudioElement>;
}

// Uses real jsdom HTMLAudioElement instances and only stubs the parts jsdom
// can't fulfil (`play()` / `pause()` — no audio backend). Tests then exercise
// observable behaviour: registered listeners fire via `dispatchEvent`,
// property writes round-trip on the element, etc.
//
// Called once at module load. The `beforeEach`/`afterEach` calls inside this
// helper register Vitest hooks at the file level — Vitest picks them up just
// as if they had been written at the top of the file — so every test in the
// file gets fresh mocks installed/torn down automatically.
const useAudioElementMocks = (): AudioMocks => {
  const handle = { instances: [] as HTMLAudioElement[] } as AudioMocks;

  beforeEach(() => {
    handle.instances = [];

    // jsdom's HTMLMediaElement.play() rejects by default (no media backend);
    // resolve it so the source's `.catch(...)` natural-finish path isn't
    // triggered by every play call. Tests can override per-case.
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    const RealAudio = window.Audio;
    handle.ctor = vi.fn((url?: string) => {
      const audio = new RealAudio(url);
      handle.instances.push(audio);
      return audio;
    });
    vi.stubGlobal('Audio', handle.ctor);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  return handle;
};

const audio = useAudioElementMocks();

// @vitest-environment jsdom
describe('start', () => {
  it('should construct an Audio element with the configured URL', () => {
    new CustomTone('http://example/ring.mp3', 0).start();

    expect(audio.ctor).toBeCalledWith('http://example/ring.mp3');
  });

  it('should loop indefinitely when repeat is 0', () => {
    new CustomTone('http://example/ring.mp3', 0).start();

    expect(audio.instances[0].loop).toBe(true);
    expect(audio.instances[0].play).toBeCalled();
  });

  it('should re-play (not loop natively) when repeat is finite', () => {
    new CustomTone('http://example/ring.mp3', 2).start();

    expect(audio.instances[0].loop).not.toBe(true);
    // Observable proof the 'ended' listener was registered: dispatching the
    // event triggers a second play().
    audio.instances[0].dispatchEvent(new Event('ended'));
    expect(audio.instances[0].play).toBeCalledTimes(2);
  });

  it('should reset currentTime before play', () => {
    new CustomTone('http://example/ring.mp3', 0).start();

    expect(audio.instances[0].currentTime).toBe(0);
    expect(audio.instances[0].play).toBeCalled();
  });

  it('should no-op when called twice without stop', () => {
    const tone = new CustomTone('http://example/ring.mp3', 0);

    tone.start();
    tone.start();

    expect(audio.ctor).toBeCalledTimes(1);
  });

  it('should fire finishedHandler when Audio construction throws', () => {
    audio.ctor.mockImplementation(() => {
      throw new Error('unsupported');
    });
    const onFinished = vi.fn();

    new CustomTone('http://example/ring.mp3', 0).start(onFinished);

    expect(onFinished).toBeCalled();
  });

  it('should fire finishedHandler when play() rejects (e.g. autoplay block)', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      new Error('autoplay-blocked'),
    );
    const onFinished = vi.fn();

    new CustomTone('http://example/ring.mp3', 0).start(onFinished);
    // Let the rejected promise settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onFinished).toBeCalled();
  });
});

describe('repeat counter', () => {
  it('should fire finishedHandler after the configured number of iterations', () => {
    const onFinished = vi.fn();

    new CustomTone('http://example/ring.mp3', 3).start(onFinished);

    // Iteration 1 already started by `start()`. Two more 'ended' events
    // should re-play, and the third 'ended' should finish.
    expect(audio.instances[0].play).toBeCalledTimes(1);
    audio.instances[0].dispatchEvent(new Event('ended'));
    expect(audio.instances[0].play).toBeCalledTimes(2);
    audio.instances[0].dispatchEvent(new Event('ended'));
    expect(audio.instances[0].play).toBeCalledTimes(3);
    expect(onFinished).not.toBeCalled();
    audio.instances[0].dispatchEvent(new Event('ended'));

    expect(onFinished).toBeCalledTimes(1);
  });

  it('should ignore ended events after stop', () => {
    const onFinished = vi.fn();
    const tone = new CustomTone('http://example/ring.mp3', 3);

    tone.start(onFinished);
    const element = audio.instances[0];
    tone.stop();
    // stop() should have removed the 'ended' listener, so dispatching is a
    // no-op as far as the source is concerned.
    element.dispatchEvent(new Event('ended'));

    expect(onFinished).not.toBeCalled();
  });
});

describe('stop', () => {
  it('should pause and detach the audio element', () => {
    const tone = new CustomTone('http://example/ring.mp3', 2);
    tone.start();
    const element = audio.instances[0];

    tone.stop();

    expect(element.pause).toBeCalled();
    // Confirm the 'ended' listener is gone: dispatching it must not re-play.
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    element.dispatchEvent(new Event('ended'));
    expect(element.play).not.toBeCalled();
  });

  it('should not fire finishedHandler on external stop', () => {
    const onFinished = vi.fn();
    const tone = new CustomTone('http://example/ring.mp3', 0);
    tone.start(onFinished);

    tone.stop();

    expect(onFinished).not.toBeCalled();
  });

  it('should be safe to call before start', () => {
    expect(() => new CustomTone('http://example/ring.mp3', 0).stop()).not.toThrow();
  });
});
