import { LitElement } from 'lit';
import { FullscreenElement, MediaPlayerController } from '../../types';
import { CachedValueController } from '../cached-value-controller';

export class UpdatingImageMediaPlayerController implements MediaPlayerController {
  private _host: LitElement;
  private _getImageCallback: () => HTMLImageElement | null;
  private _getCachedValueController: () => CachedValueController<string> | null;

  constructor(
    host: LitElement,
    getImageCallback: () => HTMLImageElement | null,
    getCachedValueController: () => CachedValueController<string> | null,
  ) {
    this._host = host;
    this._getImageCallback = getImageCallback;
    this._getCachedValueController = getCachedValueController;
  }

  public async play(): Promise<void> {
    await this._host.updateComplete;
    this._getCachedValueController()?.startTimer();
  }

  public async pause(): Promise<void> {
    await this._host.updateComplete;
    this._getCachedValueController()?.stopTimer();
  }

  public async mute(): Promise<void> {
    // Not implemented.
  }

  public async unmute(): Promise<void> {
    // Not implemented.
  }

  public isMuted(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async seek(_seconds: number): Promise<void> {
    // Not implemented.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls: boolean): Promise<void> {
    // Not implemented.
  }

  public isPaused(): boolean {
    return !this._getCachedValueController()?.hasTimer();
  }

  public async getScreenshotURL(): Promise<string | null> {
    await this._host.updateComplete;
    return this._getCachedValueController()?.value ?? null;
  }

  public getFullscreenElement(): FullscreenElement | null {
    return this._getImageCallback() ?? null;
  }
}
