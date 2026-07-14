// A monotonic counter for guarding against stale asynchronous results. Snapshot
// the current generation before an `await`; afterwards, `isCurrent()` reports
// whether anything has invalidated that snapshot since (a reset, a teardown, or
// a newer operation), so a superseded result can be dropped.
export class Generation {
  private _value = 0;

  // Invalidate all outstanding snapshots (e.g. on reset or teardown).
  public invalidate(): void {
    this._value++;
  }

  // Start a new latest-wins operation -- invalidating any outstanding snapshot --
  // and return its token.
  public next(): number {
    return ++this._value;
  }

  // Snapshot the current generation to compare after an await.
  public current(): number {
    return this._value;
  }

  // Whether the token is still current (nothing has invalidated it since it was
  // taken).
  public isCurrent(token: number): boolean {
    return token === this._value;
  }
}
