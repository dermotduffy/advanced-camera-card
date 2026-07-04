import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { Camera } from '../../../camera-manager/camera';
import type { StateWatcherSubscriptionInterface } from '../../../card-controller/hass/state-watcher';
import type { MediaUnavailableIssueReason } from '../../../card-controller/issues/issues/media-unavailable';
import type { IssueTriggerEventData } from '../../../card-controller/issues/types';
import type { CameraConfig } from '../../../config/schema/cameras';
import type { HomeAssistant } from '../../../ha/types';
import { fireAdvancedCameraCardEvent } from '../../../utils/fire-advanced-camera-card-event';
import { EntityAvailabilityDetector } from './detectors/entity-availability';
import { MediaPlayerLivenessDetector } from './detectors/media-player-liveness';
import { ProviderErrorDetector } from './detectors/provider-error';

// How far a verdict's evidence is trusted, so direct observation of the media
// outweighs an indirect signal:
// - `direct`: observed from the media itself (e.g. frames arriving or
//   stalling).
// - `indirect`: inferred from a correlated signal (e.g. the camera entity's
//   state).
// - `hard`: an authoritative failure (e.g. a provider error, or the user's
//   always_error opt-in) that overrides even direct evidence of life.
export type LivenessAuthority = 'hard' | 'direct' | 'indirect';

export type LivenessVerdict =
  // No evidence: the detector is not observing, so it neither confirms nor
  // denies liveness. A silent detector must never masquerade as proof of life.
  | { state: 'unknown' }

  // Media is confirmed to be flowing.
  | { state: 'live'; authority: LivenessAuthority }

  // Media is confirmed not to be flowing.
  | {
      state: 'not_live';
      authority: LivenessAuthority;
      reason: MediaUnavailableIssueReason;

      // Whether the wrapper should replace the provider with a reconnecting
      // placeholder (a silent freeze, e.g. an unavailable camera). Omitted when
      // the provider renders its own error and should stay mounted.
      renderPlaceholder?: boolean;
    };

// The reconnecting placeholder the wrapper renders in place of a frozen
// provider, carrying the cause so it can show a cause-specific message.
export interface LivenessPlaceholder {
  reason: MediaUnavailableIssueReason;
}

export interface LivenessDetector {
  // Start observing the signal.
  subscribe(): void;

  // Stop observing (e.g. on disconnect). Accumulated state is retained so a
  // later reconnect resumes where it left off; use reset() to discard it.
  unsubscribe(): void;

  // Discard accumulated state because the underlying stream changed (e.g. a
  // substream switch), so detection restarts from scratch.
  reset?(): void;

  // Reports the stream's current liveness, calling `onChange` (passed at
  // construction) whenever that verdict changes.
  getVerdict(): LivenessVerdict;
}

interface StreamLivenessControllerConfig {
  getTargetID: () => string | null;
  getHASS: () => HomeAssistant | null;
  getCamera: () => Camera | null;
  getStateWatcher: () => StateWatcherSubscriptionInterface | null;
}

/**
 * Coordinates liveness detection for a single live provider and surfaces a
 * `media_unavailable` "issue" when the underlying stream stops delivering media. The
 * issue framework owns the throttled reload that recovers the stream.
 */
export class StreamLivenessController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _config: StreamLivenessControllerConfig;
  private _detectors: LivenessDetector[];

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    config: StreamLivenessControllerConfig,
  ) {
    this._host = host;
    this._config = config;

    const onChange = (): void => this._onDetectorChange();
    const getCameraConfig = (): CameraConfig | null =>
      config.getCamera()?.getConfig() ?? null;

    this._detectors = [
      new ProviderErrorDetector(host, onChange),
      new EntityAvailabilityDetector({
        getHASS: config.getHASS,
        getStateWatcher: config.getStateWatcher,
        getCameraEntity: () => getCameraConfig()?.camera_entity ?? null,
        isAlwaysError: () =>
          getCameraConfig()?.always_error_if_entity_unavailable ?? false,
        onChange,
      }),
      new MediaPlayerLivenessDetector(host, onChange),
    ];
    this._host.addController(this);
  }

  public hostConnected(): void {
    this._detectors.forEach((detector) => detector.subscribe());
  }

  public hostDisconnected(): void {
    this._detectors.forEach((detector) => detector.unsubscribe());
  }

  public isLive(): boolean {
    return this._getVerdict().state !== 'not_live';
  }

  // The reconnecting placeholder to render in place of the (frozen) provider,
  // carrying the cause so the wrapper can show a cause-specific message. Null
  // when the provider should stay mounted (live, or a provider error that
  // renders its own error).
  public getPlaceholder(): LivenessPlaceholder | null {
    const verdict = this._getVerdict();
    return verdict.state === 'not_live' && verdict.renderPlaceholder
      ? { reason: verdict.reason }
      : null;
  }

  // Discard detector state on a stream change (e.g. a stream switch).
  public reset(): void {
    this._detectors.forEach((detector) => detector.reset?.());
  }

  // Reduce the detectors to a single verdict. Direct evidence from the media
  // itself (e.g. lack of frame stalls) outranks indirect signals (e.g.
  // entity-availability), so a stream that is demonstrably delivering frames is
  // never torn down just because its camera entity blipped unavailable. `hard`
  // failures (a provider error, or the always_error opt-in) outrank everything.
  private _getVerdict(): LivenessVerdict {
    const verdicts = this._detectors.map((detector) => detector.getVerdict());
    const find = (
      state: 'live' | 'not_live',
      authority: LivenessAuthority,
    ): LivenessVerdict | null =>
      verdicts.find(
        (v) => 'authority' in v && v.state === state && v.authority === authority,
      ) ?? null;

    // `unknown` verdicts carry no authority, so they match none of these lookups
    // and are skipped; if every detector is silent the reduction is `unknown`.
    return (
      find('not_live', 'hard') ??
      find('not_live', 'direct') ??
      find('live', 'direct') ??
      find('not_live', 'indirect') ?? { state: 'unknown' }
    );
  }

  private _onDetectorChange(): void {
    const verdict = this._getVerdict();
    if (verdict.state === 'not_live') {
      this._triggerMediaUnavailableIssue(verdict.reason);
    }
    this._host.requestUpdate();
  }

  // Tell the issue framework this target's media is not loaded, surfacing the
  // media_unavailable issue (status bar + retry) and its throttled reload.
  private _triggerMediaUnavailableIssue(reason: MediaUnavailableIssueReason): void {
    const targetID = this._config.getTargetID();
    if (!targetID) {
      return;
    }
    fireAdvancedCameraCardEvent<IssueTriggerEventData>(this._host, 'issue:trigger', {
      key: 'media_unavailable',
      targetID,
      reason,
    });
  }
}
