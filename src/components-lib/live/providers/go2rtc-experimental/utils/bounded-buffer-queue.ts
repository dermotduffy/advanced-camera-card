// A byte-bounded FIFO queue of ArrayBuffer chunks: a push that would exceed the
// byte cap is rejected.
export class BoundedBufferQueue {
  private _buffers: ArrayBuffer[] = [];
  private _bytes = 0;

  private _maxBytes: number;

  constructor(maxBytes: number) {
    this._maxBytes = maxBytes;
  }

  public get isEmpty(): boolean {
    return this._buffers.length === 0;
  }

  // Stage a chunk at the back, or return false (staging nothing) if it would
  // exceed the byte cap.
  public push(data: ArrayBuffer): boolean {
    if (this._bytes + data.byteLength > this._maxBytes) {
      return false;
    }
    this._buffers.push(data);
    this._bytes += data.byteLength;
    return true;
  }

  // Remove and return the oldest staged chunk, or null when empty.
  public shift(): ArrayBuffer | null {
    const data = this._buffers.shift();
    if (!data) {
      return null;
    }
    this._bytes -= data.byteLength;
    return data;
  }

  public clear(): void {
    this._buffers = [];
    this._bytes = 0;
  }
}
