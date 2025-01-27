import { WebkitHTMLVideoElement } from '../../../types';
import { Timer } from '../../../utils/timer';
import { ConditionState } from '../../conditions-manager';
import { FullscreenProviderBase } from '../provider';
import { FullscreenProvider } from '../types';

const WEBKIT_PLAY_SECONDS = 0.5;

/**
 * Fullscreen implementation for webkit based browsers that do not support the
 * standard Fullscreen API (expected to be exclusively iOS on an iPhone).
 * See: https://github.com/dermotduffy/frigate-hass-card/issues/1444
 */
export class WebkitFullScreenProvider
  extends FullscreenProviderBase
  implements FullscreenProvider
{
  protected _playTimer = new Timer();

  public connect(): void {
    this._api.getConditionsManager().addListener(this._conditionChangeHandler);
  }

  public disconnect(): void {
    this._api.getConditionsManager().removeListener(this._conditionChangeHandler);
  }

  protected _conditionChangeHandler = (
    newState: ConditionState,
    oldState?: ConditionState,
  ): void => {
    if (
      newState.mediaLoadedInfo?.player?.getFullscreenElement() !==
      oldState?.mediaLoadedInfo?.player?.getFullscreenElement()
    ) {
      const oldElement = oldState?.mediaLoadedInfo?.player?.getFullscreenElement();
      oldElement?.removeEventListener('webkitbeginfullscreen', this._handler);
      oldElement?.removeEventListener('webkitendfullscreen', this._endHandler);

      const newElement = newState.mediaLoadedInfo?.player?.getFullscreenElement();
      newElement?.addEventListener('webkitbeginfullscreen', this._handler);
      newElement?.addEventListener('webkitendfullscreen', this._endHandler);
    }
  };

  protected _getVideoElement():
    | (HTMLVideoElement & Partial<WebkitHTMLVideoElement>)
    | null {
    const element = this._api
      .getMediaLoadedInfoManager()
      .get()
      ?.player?.getFullscreenElement();
    return element instanceof HTMLVideoElement ? element : null;
  }

  public isInFullscreen(): boolean {
    return !!this._getVideoElement()?.webkitDisplayingFullscreen;
  }

  public isSupported(): boolean {
    return !!this._getVideoElement()?.webkitSupportsFullscreen;
  }

  public setFullscreen(fullscreen: boolean): void {
    if (!this.isSupported()) {
      return;
    }

    const video = this._getVideoElement();

    if (fullscreen) {
      video?.webkitEnterFullscreen?.();
    } else {
      video?.webkitExitFullscreen?.();
    }
  }

  protected _endHandler = (): void => {
    this._handler();

    // Webkit on iPhone stops the video when exiting fullscreen (why!). This
    // hack workaround has the disadvantage that there's no way to tell if the
    // video was legitimately paused before they user exited fullscreen (as the
    // common path is for exit fullscreen to not involve
    // setFullscreen(...) being called at all, but rather the user simply
    // clicking the 'X' which then fires this event). That's probably the rare
    // case though.
    this._playTimer.start(WEBKIT_PLAY_SECONDS, () => {
      this._getVideoElement()?.play();
    });
  };
}
