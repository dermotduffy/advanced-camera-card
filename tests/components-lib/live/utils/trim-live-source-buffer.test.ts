import { describe, expect, it, vi } from 'vitest';

import { trimLiveSourceBuffer } from '../../../../src/components-lib/live/utils/trim-live-source-buffer';

const createTimeRanges = (ranges: [number, number][]): TimeRanges => ({
  length: ranges.length,
  start: (index: number) => ranges[index][0],
  end: (index: number) => ranges[index][1],
});

const createMediaSource = (duration = Number.NaN) => ({
  duration,
  setLiveSeekableRange: vi.fn(),
});

const createSourceBuffer = (ranges: [number, number][]) =>
  ({
    buffered: createTimeRanges(ranges),
    remove: vi.fn(),
  }) as unknown as SourceBuffer;

describe('trimLiveSourceBuffer', () => {
  it('should set an infinite duration before trimming a live source', () => {
    const mediaSource = createMediaSource();
    const sourceBuffer = createSourceBuffer([[0, 20]]);

    trimLiveSourceBuffer(mediaSource, sourceBuffer, 5, 20);

    expect(mediaSource.duration).toBe(Number.POSITIVE_INFINITY);
    expect(sourceBuffer.remove).toHaveBeenCalledWith(0, 5);
    expect(mediaSource.setLiveSeekableRange).toHaveBeenCalledWith(5, 20);
  });

  it('should keep a duration that already covers the buffer', () => {
    const mediaSource = createMediaSource(100);
    const sourceBuffer = createSourceBuffer([[0, 20]]);

    trimLiveSourceBuffer(mediaSource, sourceBuffer, 5, 20);

    expect(mediaSource.duration).toBe(100);
    expect(sourceBuffer.remove).toHaveBeenCalledWith(0, 5);
  });

  it('should use a finite duration when infinity is rejected', () => {
    let stored = Number.NaN;
    const mediaSource = {
      get duration() {
        return stored;
      },
      set duration(value: number) {
        if (!Number.isFinite(value)) {
          throw new TypeError('Infinity rejected');
        }
        stored = value;
      },
      setLiveSeekableRange: vi.fn(),
    };
    const sourceBuffer = createSourceBuffer([[0, 20]]);

    trimLiveSourceBuffer(mediaSource, sourceBuffer, 15, 20);

    // The fallback sits one retained window (5s) past the buffer end.
    expect(stored).toBe(25);
    expect(sourceBuffer.remove).toHaveBeenCalledWith(0, 15);
    expect(mediaSource.setLiveSeekableRange).toHaveBeenCalledWith(15, 20);
  });

  it('should swallow a remove failure', () => {
    const mediaSource = createMediaSource();
    const sourceBuffer = createSourceBuffer([[0, 20]]);
    sourceBuffer.remove = vi.fn(() => {
      throw new TypeError('Type error');
    });

    expect(() => trimLiveSourceBuffer(mediaSource, sourceBuffer, 5, 20)).not.toThrow();
    expect(mediaSource.setLiveSeekableRange).not.toHaveBeenCalled();
  });

  it('should do nothing when all media is inside the retained window', () => {
    const mediaSource = createMediaSource();
    const sourceBuffer = createSourceBuffer([[16, 20]]);

    trimLiveSourceBuffer(mediaSource, sourceBuffer, 5, 20);

    expect(sourceBuffer.remove).not.toHaveBeenCalled();
    expect(mediaSource.setLiveSeekableRange).not.toHaveBeenCalled();
    expect(mediaSource.duration).toBeNaN();
  });
});
