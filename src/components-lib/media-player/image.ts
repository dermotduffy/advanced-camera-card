import { LitElement } from 'lit';
import { FullscreenElement, MediaPlayerController } from '../../types';
import { screenshotImage } from '../../utils/screenshot';

export class ImageMediaPlayerController implements MediaPlayerController {
  private _host: LitElement;
  private _getImageCallback: () => HTMLImageElement | null;

  constructor(host: LitElement, getImageCallback: () => HTMLImageElement | null) {
    this._host = host;
    this._getImageCallback = getImageCallback;
  }

  public async play(): Promise<void> {
    // Not implemented.
  }

  public async pause(): Promise<void> {
    // Not implemented.
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
    // The image could be an MJPEG, so it is always reported unpaused.
    return false;
  }

  public async getScreenshotURL(): Promise<string | null> {
    await this._host.updateComplete;

    const image = this._getImageCallback();

    // It might an MJPEG so still need to screenshot it.
    return image ? screenshotImage(image) : null;
  }

  public getFullscreenElement(): FullscreenElement | null {
    return this._getImageCallback() ?? null;
  }
}
