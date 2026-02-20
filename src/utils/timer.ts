export class Timer {
  private _timer: number | null = null;
  private _repeated = false;

  public stop(): void {
    if (this._timer) {
      if (this._repeated) {
        window.clearInterval(this._timer);
      } else {
        window.clearTimeout(this._timer);
      }
      this._timer = null;
    }
  }

  public isRunning(): boolean {
    return this._timer !== null;
  }

  public start(seconds: number, func: () => void): void {
    this.stop();
    this._timer = window.setTimeout(() => {
      this._timer = null;
      func();
    }, seconds * 1000);
    this._repeated = false;
  }

  public startRepeated(seconds: number, func: () => void): void {
    this.stop();
    this._timer = window.setInterval(() => {
      func();
    }, seconds * 1000);
    this._repeated = true;
  }
}
