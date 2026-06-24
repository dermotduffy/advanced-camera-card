import { MicrophoneState } from '../card-controller/types.js';
import {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
} from '../config/schema/common/media-actions.js';
import { MediaPlayerElement } from '../types.js';
import { Timer } from '../utils/timer.js';
import { VisibilityObserver } from './visibility-observer.js';

export interface MediaActionsControllerOptions {
  playerSelector: string;

  autoPlayConditions?: readonly AutoPlayCondition[];
  autoUnmuteConditions?: readonly AutoUnmuteCondition[];
  autoPauseConditions?: readonly AutoPauseCondition[];
  autoMuteConditions?: readonly AutoMuteCondition[];

  microphoneMuteSeconds?: number;
}

type RenderRoot = HTMLElement;

/**
 * General note: Always unmute before playing, since Chrome may pause a piece of
 * media if the page hasn't been interacted with first, after unmute. By unmuting
 * first, even if the unmute call fails a subsequent call to play will still
 * start the video.
 */

interface MediaActionsTarget {
  selected: boolean;
  index: number;
}

export class MediaActionsController {
  private _options: MediaActionsControllerOptions | null = null;
  private _microphoneMuteTimer = new Timer();
  private _root: RenderRoot | null = null;

  // Audio-related state fed in via dedicated setters (not `setOptions`, which
  // is pure configuration).
  private _microphoneState?: MicrophoneState;
  private _callAnswered = false;

  // Deferred because the media player is not always ready when a call starts:
  // the call may start from another view, or engage a substream that is still
  // loading. Applied by `_applyPendingCallStartAction`.
  private _pendingCallStartAction = false;

  private _eventListeners = new Map<HTMLElement, () => void>();
  private _children: MediaPlayerElement[] = [];
  private _target: MediaActionsTarget | null = null;
  private _mutationObserver = new MutationObserver(this._mutationHandler.bind(this));
  private _visibilityObserver: VisibilityObserver;

  constructor() {
    this._visibilityObserver = new VisibilityObserver((visible) =>
      this._changeVisibility(visible),
    );
  }

  public setOptions(options: MediaActionsControllerOptions): void {
    this._options = options;
  }

  public setMicrophoneState(state: MicrophoneState): void {
    const previous = this._microphoneState;
    this._microphoneState = state;
    void this._microphoneStateChangeHandler(previous, state);
  }

  // Audio-out auto-mute/unmute driven by call answer: unmute when the call
  // is answered (hear the caller), mute when an answered call ends. Acts only
  // on a genuine transition. The first-ever `true` counts as a transition: a
  // carousel that loads while an answered call is already active must still
  // unmute. An inbound call that's rejected pre-answer never sees a `true`,
  // so neither side fires -- the camera audio is never auto-disturbed by a
  // call the user didn't accept.
  public setCallAnswered(answered: boolean): void {
    if (answered === this._callAnswered) {
      return;
    }
    this._callAnswered = answered;
    if (answered) {
      this._pendingCallStartAction = true;
      void this._applyPendingCallStartAction();
    } else {
      this._pendingCallStartAction = false;
      void this._muteTargetIfConfigured('call');
    }
  }

  public hasRoot(): boolean {
    return !!this._root;
  }

  public destroy(): void {
    this._microphoneMuteTimer.stop();
    this._root = null;
    this._removeChildHandlers();
    this._children = [];
    this._target = null;
    this._mutationObserver.disconnect();
    this._visibilityObserver.destroy();
  }

  public async setTarget(index: number, selected: boolean): Promise<void> {
    if (this._target?.index === index && this._target?.selected === selected) {
      return;
    }

    // If there's already a selected target, unselect it.
    if (!!this._target?.selected) {
      await this._pauseTargetIfConfigured('unselected');
      await this._muteTargetIfConfigured('unselected');
      this._microphoneMuteTimer.stop();
    }

    this._target = {
      selected,
      index,
    };

    // A call may have started before this target existed; honor it now.
    await this._applyPendingCallStartAction();

    if (selected) {
      await this._unmuteTargetIfConfigured('selected');
      await this._playTargetIfConfigured('selected');
    } else {
      await this._unmuteTargetIfConfigured('visible');
      await this._playTargetIfConfigured('visible');
    }
  }

  public unsetTarget(): void {
    this._target = null;
  }

  private async _playTargetIfConfigured(condition: AutoPlayCondition): Promise<void> {
    if (
      this._target !== null &&
      this._options?.autoPlayConditions?.includes(condition)
    ) {
      await this._play(this._target.index);
    }
  }
  private async _play(index: number): Promise<void> {
    await (await this._children[index]?.getMediaPlayerController())?.play();
  }
  private async _unmuteTargetIfConfigured(
    condition: AutoUnmuteCondition,
  ): Promise<void> {
    if (
      this._target !== null &&
      this._options?.autoUnmuteConditions?.includes(condition)
    ) {
      await this._unmute(this._target.index);
    }
  }
  private async _unmute(index: number): Promise<void> {
    await (await this._children[index]?.getMediaPlayerController())?.unmute();
  }

  // The call-start action is currently a single unmute (hear the caller),
  // applied once the media player is ready. The call-end mute is not deferred
  // here: a mute that misses a not-yet-ready element is harmless, since
  // elements start muted.
  private async _applyPendingCallStartAction(): Promise<void> {
    if (
      !this._pendingCallStartAction ||
      this._target === null ||
      !this._options?.autoUnmuteConditions?.includes('call')
    ) {
      return;
    }

    const controller =
      await this._children[this._target.index]?.getMediaPlayerController();
    if (!controller) {
      // Media not ready yet -- retried from `setTarget` / `_mediaLoadedHandler`.
      return;
    }

    this._pendingCallStartAction = false;
    await controller.unmute();
  }

  private async _pauseAllIfConfigured(condition: AutoPauseCondition): Promise<void> {
    if (this._options?.autoPauseConditions?.includes(condition)) {
      for (const index of this._children.keys()) {
        await this._pause(index);
      }
    }
  }
  private async _pauseTargetIfConfigured(condition: AutoPauseCondition): Promise<void> {
    if (
      this._target !== null &&
      this._options?.autoPauseConditions?.includes(condition)
    ) {
      await this._pause(this._target.index);
    }
  }
  private async _pause(index: number): Promise<void> {
    await (await this._children[index]?.getMediaPlayerController())?.pause();
  }

  private async _muteAllIfConfigured(condition: AutoMuteCondition): Promise<void> {
    if (this._options?.autoMuteConditions?.includes(condition)) {
      for (const index of this._children.keys()) {
        await this._mute(index);
      }
    }
  }
  private async _muteTargetIfConfigured(condition: AutoMuteCondition): Promise<void> {
    if (
      this._target !== null &&
      this._options?.autoMuteConditions?.includes(condition)
    ) {
      await this._mute(this._target.index);
    }
  }
  private async _mute(index: number): Promise<void> {
    await (await this._children[index]?.getMediaPlayerController())?.mute();
  }

  private _mutationHandler(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mutations: MutationRecord[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _observer: MutationObserver,
  ): void {
    this._initializeRoot();
  }

  private _mediaLoadedHandler = async (index: number): Promise<void> => {
    if (this._target?.index !== index) {
      return;
    }
    // Re-assert audio mute/play here because the media element may not have
    // been ready when setTarget originally fired. The microphone manager has
    // no such constraint, so it is intentionally not re-asserted here -- doing
    // so would clobber any manual user mute made between target selection and
    // media load.
    const condition = this._target.selected ? 'selected' : 'visible';
    await this._unmuteTargetIfConfigured(condition);

    // The media element is ready now; apply any call-start action that was
    // deferred because it was not.
    await this._applyPendingCallStartAction();
    await this._playTargetIfConfigured(condition);
  };

  private _removeChildHandlers(): void {
    for (const [child, callback] of this._eventListeners.entries()) {
      child.removeEventListener('advanced-camera-card:media:loaded', callback);
    }
    this._eventListeners.clear();
  }

  public setRoot(root: RenderRoot): boolean {
    if (root === this._root) {
      return false;
    }

    this._target = null;
    this._root = root;
    this._initializeRoot();

    this._visibilityObserver.setRoot(this._root);

    this._mutationObserver.disconnect();
    this._mutationObserver.observe(this._root, { childList: true, subtree: true });
    return true;
  }

  private _initializeRoot(): void {
    if (!this._options || !this._root) {
      return;
    }

    this._removeChildHandlers();

    this._children = [
      ...this._root.querySelectorAll<MediaPlayerElement>(this._options.playerSelector),
    ];

    for (const [index, child] of this._children.entries()) {
      const eventListener = () => this._mediaLoadedHandler(index);
      this._eventListeners.set(child, eventListener);
      child.addEventListener('advanced-camera-card:media:loaded', eventListener);
    }
  }

  private _changeVisibility = async (visible: boolean): Promise<void> => {
    if (visible) {
      await this._unmuteTargetIfConfigured('visible');
      await this._playTargetIfConfigured('visible');
    } else {
      await this._pauseAllIfConfigured('hidden');
      await this._muteAllIfConfigured('hidden');
    }
  };

  private async _microphoneStateChangeHandler(
    oldState?: MicrophoneState,
    newState?: MicrophoneState,
  ): Promise<void> {
    if (!oldState || !newState) {
      return;
    }

    if (oldState.muted && !newState.muted) {
      await this._unmuteTargetIfConfigured('microphone');
    } else if (
      !oldState.muted &&
      newState.muted &&
      this._options?.autoMuteConditions?.includes('microphone')
    ) {
      this._microphoneMuteTimer.start(
        this._options.microphoneMuteSeconds ?? 60,
        async () => {
          await this._muteTargetIfConfigured('microphone');
        },
      );
    }
  }
}
