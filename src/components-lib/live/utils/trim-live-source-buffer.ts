// The slice both MSE players need. The experimental player wraps MediaSource;
// the classic player uses the browser object directly.
export interface LiveSourceBufferMediaSource {
  duration: number;
  setLiveSeekableRange(startSeconds: number, endSeconds: number): void;
}

// Drops media older than retainedStart and re-declares that window as seekable.
// WebKit throws TypeError from SourceBuffer.remove() while a live duration is
// still NaN, and that exception escapes updateend. Infinity makes the call
// legal without giving the element a finite end. A value one retained window
// ahead of the buffer is the fallback when Infinity is rejected. Failure is
// swallowed: the append that just finished still plays, and the next updateend
// tries the cleanup again.
export const trimLiveSourceBuffer = (
  mediaSource: LiveSourceBufferMediaSource,
  sourceBuffer: SourceBuffer,
  retainedStart: number,
  end: number,
): void => {
  try {
    const bufferedStart = sourceBuffer.buffered.start(0);
    if (retainedStart <= bufferedStart) {
      return;
    }

    ensureDurationAllowsRemoval(mediaSource, end, end - retainedStart);
    sourceBuffer.remove(bufferedStart, retainedStart);
    mediaSource.setLiveSeekableRange(retainedStart, end);
  } catch {
    // Best-effort. See the comment above.
  }
};

const ensureDurationAllowsRemoval = (
  mediaSource: LiveSourceBufferMediaSource,
  end: number,
  retainedSeconds: number,
): void => {
  const duration = mediaSource.duration;
  if (!Number.isNaN(duration) && duration >= end) {
    return;
  }

  try {
    mediaSource.duration = Number.POSITIVE_INFINITY;
  } catch {
    mediaSource.duration = end + retainedSeconds;
  }
};
