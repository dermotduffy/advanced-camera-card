import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { MediaLoadedInfoEventDetail } from '../types';
import { onAbort } from '../utils/abort-signal';
import { Generation } from '../utils/concurrency/generation';
import { Timer } from '../utils/timer';
import {
  resolveMediaUnavailableIssue,
  triggerMediaUnavailableIssue,
} from './media-unavailable-issue';

const MEDIA_LOADED_EVENT = 'advanced-camera-card:media:loaded';

export const MEDIA_LOADING_TIMEOUT_SECONDS = 10;

interface MediaLoadWatchdogConfig {
  getTargetID: () => string | null;

  // Whether the host is currently trying to load media. False when loading is
  // held back (e.g. lazy loading), or when the host is showing a failure of its
  // own rather than waiting for media.
  isLoadExpected: () => boolean;

  // Changes when the media underneath is rebuilt without the host itself being
  // rebuilt (e.g. a retry re-keying a player below it), so the wait starts
  // again. Omitted by a host that a retry replaces outright.
  getAttemptID?: () => unknown;
}

/**
 * Watches a media host's load: when the host expects media but none arrives
 * within the window, raises a `media_unavailable` issue with reason
 * `not_loading`, and clears it again once media does arrive.
 *
 * Loads are observed from the host's own bubble path, so a `media:loaded`
 * dispatched by any descendant player ends the wait, and that media going away
 * (its event's abort signal) restarts it if a load is still expected.
 *
 * A host may be reused for a succession of targets (a viewer slide swiped from
 * one media item to the next), so everything learned is scoped to the target it
 * was learned about. A target change starts a fresh wait and resolves any
 * failure reported for the target left behind.
 */
export class MediaLoadWatchdogController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _config: MediaLoadWatchdogConfig;

  private _timer = new Timer();

  // What the state below describes: the target, and which attempt at loading it
  // (see `getAttemptID`). A change in either means everything known is about
  // media the host has moved on from.
  private _targetID: string | null = null;
  private _attemptID: unknown = undefined;

  private _mediaLoaded = false;

  // Identifies which load `_mediaLoaded` describes. One player can replace
  // another for the same target before the first has gone away, and the first
  // going away must not be read as the current media being lost.
  private _loadGeneration = new Generation();

  // Whether the timeout has fired for the current attempt, so a hung load is
  // reported only once. A retry is a new attempt and is waited on afresh.
  private _fired = false;

  // The target this watchdog has an outstanding failure reported for, so that
  // failure can be resolved if the host moves on to another target. It
  // outlives the attempt that reported it, which keeps the failure on screen
  // while a retry runs underneath.
  private _reportedTargetID: string | null = null;

  // Media loads, and the media going away, are observed through listeners and
  // abort signals that can outlive a disconnect, and a detached host must not be
  // waited on.
  private _connected = false;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    config: MediaLoadWatchdogConfig,
  ) {
    this._host = host;
    this._config = config;
    host.addController(this);
  }

  public hostConnected(): void {
    this._connected = true;
    this._host.addEventListener(MEDIA_LOADED_EVENT, this._onMediaLoaded);
    this._evaluate();
  }

  public hostDisconnected(): void {
    this._connected = false;
    this._host.removeEventListener(MEDIA_LOADED_EVENT, this._onMediaLoaded);
    this._timer.stop();
  }

  public hostUpdated(): void {
    this._evaluate();
  }

  private _forgetLoad(): void {
    this._mediaLoaded = false;
    this._fired = false;
    this._loadGeneration.invalidate();
    this._timer.stop();
  }

  private _onMediaLoaded = (ev: CustomEvent<MediaLoadedInfoEventDetail>): void => {
    const targetID = ev.detail.info.targetID;

    // The host's own target is read fresh so a load arriving as the host
    // switches is attributed to whichever target it actually describes.
    if (!targetID || targetID !== this._config.getTargetID()) {
      return;
    }

    // This load replaces whatever was being followed, which may be a different
    // target the host has just moved off.
    this._syncAttempt();
    this._forgetLoad();

    this._mediaLoaded = true;
    const generation = this._loadGeneration.next();

    if (this._reportedTargetID === targetID) {
      this._reportedTargetID = null;
    }
    resolveMediaUnavailableIssue(this._host, { targetID, cause: 'media-loaded' });

    // Media going away is not itself a failure, but a load that is still
    // expected afterwards needs a fresh wait. This is recorded whether or not
    // the host is attached, since a detached host has no media either.
    onAbort(ev.detail.signal, () => {
      if (targetID !== this._targetID || !this._loadGeneration.isCurrent(generation)) {
        return;
      }

      this._mediaLoaded = false;
      this._evaluate();
    });
  };

  // Discard everything learned about a previous target, or a previous attempt
  // at the same one.
  private _syncAttempt(): void {
    const targetID = this._config.getTargetID();
    const attemptID = this._config.getAttemptID?.();
    if (targetID === this._targetID && attemptID === this._attemptID) {
      return;
    }

    // If an issue was triggered for a target since abandoned, resolve it so it
    // is not stuck forever, scoped to not-loading since that is all this
    // watchdog triggers.
    if (this._reportedTargetID && this._reportedTargetID !== targetID) {
      resolveMediaUnavailableIssue(this._host, {
        targetID: this._reportedTargetID,
        reason: 'not_loading',
      });
      this._reportedTargetID = null;
    }

    this._targetID = targetID;
    this._attemptID = attemptID;
    this._forgetLoad();
  }

  private _evaluate(): void {
    if (!this._connected) {
      return;
    }

    this._syncAttempt();

    if (!this._targetID || this._mediaLoaded || !this._config.isLoadExpected()) {
      this._fired = false;
      this._timer.stop();
      return;
    }

    if (!this._fired && !this._timer.isRunning()) {
      this._timer.start(MEDIA_LOADING_TIMEOUT_SECONDS, () => this._onTimeout());
    }
  }

  private _onTimeout(): void {
    const targetID = this._targetID;

    // Conditions may have changed while the timer matured.
    if (
      !this._connected ||
      !targetID ||
      targetID !== this._config.getTargetID() ||
      this._attemptID !== this._config.getAttemptID?.() ||
      this._mediaLoaded ||
      !this._config.isLoadExpected()
    ) {
      return;
    }

    this._fired = true;
    this._reportedTargetID = targetID;
    triggerMediaUnavailableIssue(this._host, { targetID, reason: 'not_loading' });
  }
}
