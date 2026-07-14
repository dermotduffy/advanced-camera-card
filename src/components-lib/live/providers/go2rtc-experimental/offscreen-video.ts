export type VideoElementFactory = () => HTMLVideoElement;

// A held, injectable off-screen <video> for decoding a stream separate from the
// real display element. Created lazily on first `get()` and reused until
// `clear()` detaches its media and forgets it.
export class OffscreenVideo {
  private _create: VideoElementFactory;
  private _video: HTMLVideoElement | null = null;

  constructor(create?: VideoElementFactory) {
    this._create = create ?? (() => document.createElement('video'));
  }

  // Return the held video, creating it on first use.
  public get(): HTMLVideoElement {
    return (this._video ??= this._create());
  }

  // Detach any media (whether attached via `src` or `srcObject`) and forget the
  // video. Safe to call when none is held.
  public clear(): void {
    if (this._video) {
      this._video.removeAttribute('src');
      this._video.srcObject = null;
      this._video = null;
    }
  }
}
