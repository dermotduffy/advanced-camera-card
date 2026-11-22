import { onAbort } from './abort-signal';

/**
 * Resolves once a video presents its next frame, or, where that cannot be told
 * (no video, a video showing only its poster, or a browser without
 * `requestVideoFrameCallback`), after two animation frames. Never resolves
 * once `signal` aborts.
 *
 * It waits for the next frame presented after the call, not merely a first one:
 * a slow stream (e.g. a camera at 1 frame per second) can leave the caller
 * waiting up to about one frame interval longer than needed.
 */
export const waitForPaint = (
  video: HTMLVideoElement | null,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      return;
    }

    if (
      video &&
      (video.currentSrc || video.srcObject) &&
      'requestVideoFrameCallback' in video
    ) {
      const handle = video.requestVideoFrameCallback(() => resolve());
      onAbort(signal, () => video.cancelVideoFrameCallback(handle));
      return;
    }

    let handle = window.requestAnimationFrame(() => {
      handle = window.requestAnimationFrame(() => resolve());
    });
    onAbort(signal, () => window.cancelAnimationFrame(handle));
  });
