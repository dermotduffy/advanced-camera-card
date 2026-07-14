type ImageElementFactory = () => HTMLImageElement;

// A held, injectable off-screen <img> for decoding a frame separate from the
// visible display element. Created lazily on first `get()` and reused until
// `clear()` detaches its source and forgets it.
export class OffscreenImage {
  private _create: ImageElementFactory;
  private _image: HTMLImageElement | null = null;

  constructor(create?: ImageElementFactory) {
    this._create = create ?? (() => new Image());
  }

  // Return the held image, creating it on first use.
  public get(): HTMLImageElement {
    return (this._image ??= this._create());
  }

  // Detach any source and forget the image. Safe to call when none is held.
  public clear(): void {
    if (this._image) {
      this._image.removeAttribute('src');
      this._image = null;
    }
  }
}
