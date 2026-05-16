type Edge = 'rising' | 'falling';

/**
 * Reports the rising / falling edges of a boolean fed in over time.
 *
 * The first value only establishes a baseline and reports no edge.
 */
export class EdgeDetector {
  private _value?: boolean;

  public update(value: boolean): Edge | null {
    const previous = this._value;
    this._value = value;
    if (previous === undefined || previous === value) {
      return null;
    }
    return value ? 'rising' : 'falling';
  }
}
