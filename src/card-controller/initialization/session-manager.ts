import type { AdvancedCameraCardConfig } from '../../config/schema/types';
import { Generation } from '../../utils/concurrency/generation';
import type { CardSessionAPI } from '../types';

// ============================================================================
// The card runs in "initialization sessions". A session begins when the card is
// attached to the page with a ready Home Assistant, and ends when the card is
// detached, when Home Assistant stops being ready, or when initialization
// fails. Initializing an individual aspect again (e.g. because the
// configuration changed) happens *within* a session and does not end it, akin
// to a running application staying started while it reconnects one subsystem.
//
// A session therefore involves one or more *initialization runs*: the first
// starts the card, and each later one initializes whichever aspects were
// invalidated while the session carried on. A run ends in one of three ways:
//
//  - it *succeeds*, and the card is started;
//  - it *fails*, meaning a step threw an error, and the "Issue" manager takes
//    over to display and handle the issue.
//  - it *declines*, meaning it stopped early without an error of its own -- a
//    step could not complete yet, or something else had already gone wrong.
//
// Whichever way a run ends is its outcome, reported back here with the number
// the run was given when it started.
//
// This class is the session lifecycle as a state machine, and is the only
// writer of the `initialized` and `everInitialized` condition state -- what
// users write conditions and triggers against. Whether every mandatory aspect
// is initialized right now is a separate question owned by the
// InitializationManager, and the two deliberately disagree while an aspect is
// being initialized again mid-session.
//
// There is no "failed" state: a card blocked after a failed run is IDLE with a
// full-card issue showing, and the issue system is the authority on that.
// ============================================================================

export enum SessionState {
  // No initialized session: the card is detached, Home Assistant is not ready,
  // or a run declined or failed and nothing has started another yet.
  IDLE = 'idle',

  // A session has started and its first run is under way; nothing written to
  // the condition state yet.
  INITIALIZING = 'initializing',

  // The card has started: `initialized` is true. Later runs that initialize an
  // aspect again may happen without leaving this state.
  RUNNING = 'running',
}

export class SessionManager {
  private _api: CardSessionAPI;
  private _state = SessionState.IDLE;
  private _everInitialized = false;

  // Numbers the "initialization run" currently in progress (not the session,
  // which may contain several runs). The number changes when a session ends and
  // when a run reports its outcome, so an outcome from a run that something has
  // since replaced is ignored, and so is a second outcome from the same run.
  private _generation = new Generation();

  constructor(api: CardSessionAPI) {
    this._api = api;
  }

  public getState(): SessionState {
    return this._state;
  }

  public wasEverInitialized(): boolean {
    return this._everInitialized;
  }

  // Start an "initialization run" and return the number identifying it, which
  // must be handed back with its outcome. From IDLE this is the session's first
  // run; from RUNNING it initializes an aspect again mid-session, and the state
  // (with the published `initialized`) stays as it is.
  public startInitialization(): number {
    if (this._state === SessionState.IDLE) {
      this._state = SessionState.INITIALIZING;
    }
    return this._generation.next();
  }

  public isCurrentInitialization(token: number): boolean {
    return this._generation.isCurrent(token);
  }

  // The run completed, so the card is now started. The config is written in the
  // same change as the session state, so a trigger watching either sees one
  // consistent state. When an aspect was initialized again mid-session
  // `initialized` and
  // `everInitialized` already hold these values, so the change carries only the
  // config -- which is what stops an `initialized` trigger firing again in the
  // middle of a session.
  public reportInitializationSucceeded(
    token: number,
    config: AdvancedCameraCardConfig,
  ): void {
    if (!this._acceptOutcome(token)) {
      return;
    }

    // Set before the condition state is written, so anything that reads this
    // class while handling that change sees the new state.
    this._state = SessionState.RUNNING;
    this._everInitialized = true;

    this._api.getConditionStateManager().setState({
      config,
      initialized: true,
      everInitialized: true,
    });
  }

  // The run stopped early without producing an error of its own: either a step
  // could not complete yet (e.g. the view declining while the cameras are being
  // initialized), or a full-card issue raised elsewhere makes continuing
  // pointless.
  //
  // Nothing is written -- a card that had not started has nothing to take back,
  // and one that had is still started.
  public reportInitializationDeclined(token: number): void {
    if (!this._acceptOutcome(token)) {
      return;
    }
    if (this._state === SessionState.INITIALIZING) {
      this._state = SessionState.IDLE;
    }
  }

  // The run threw an error which ends the session: a card missing a mandatory
  // aspect is not started. The initialization issue was already raised (by the
  // Issue Manager).
  public reportInitializationFailed(token: number): void {
    if (!this._acceptOutcome(token)) {
      return;
    }
    this._toIdle();
  }

  // The session is over -- the card left the page or Home Assistant went away.
  // Aspects are left as they are: a caller that knows which of them the next
  // session must initialize again invalidates those itself.
  public end(): void {
    this._generation.invalidate();
    this._toIdle();
  }

  private _toIdle(): void {
    const wasRunning = this._state === SessionState.RUNNING;
    this._state = SessionState.IDLE;

    // `initialized: false` is written only on a card that had previously
    // started.
    if (wasRunning) {
      this._api.getConditionStateManager().setState({ initialized: false });
    }
  }

  // Whether an outcome should be acted on: it must come from the run currently
  // in progress, and only the first outcome from that run counts. Invalidating
  // the generation number here is what makes a second run of the same
  // initialization do nothing.
  private _acceptOutcome(token: number): boolean {
    if (!this._generation.isCurrent(token)) {
      return false;
    }
    this._generation.invalidate();
    return true;
  }
}
