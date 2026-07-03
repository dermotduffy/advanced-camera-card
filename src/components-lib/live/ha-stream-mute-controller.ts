import type { ReactiveController, ReactiveControllerHost } from 'lit';

// Dispatched by the ha-camera-stream patch when the VISIBLE leaf's output mute
// changes. The patch resolves the visible leaf synchronously and ships the
// value here, so consumers never have to query it asynchronously.
export const HA_CAMERA_STREAM_MUTE_CHANGE_EVENT =
  'advanced-camera-card:ha-camera-stream:mute-change';

interface HACameraStreamMuteChangeDetail {
  muted: boolean;
}

interface HAStreamMuteControllerOptions {
  // Effective camera entity id of the currently displayed (possibly substream)
  // camera. A change resets the stream selection, since a reused element must
  // not inherit the previous camera's selection.
  getCameraEntityID: () => string | null;

  // Whether audio is intended on load for this camera (its auto-unmute policy
  // fires on selection/visibility). Seeds the selection on a camera change so a
  // mixed-capability camera starts on the audio-capable stream.
  getPreferAudioStream: () => boolean;
}

const isMuteChangeEvent = (
  ev: Event,
): ev is CustomEvent<HACameraStreamMuteChangeDetail> => {
  if (!(ev instanceof CustomEvent)) {
    return false;
  }
  const detail: unknown = ev.detail;
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'muted' in detail &&
    typeof detail.muted === 'boolean'
  );
};

/**
 * Owns the HA stream's mute state for `advanced-camera-card-live-ha`, split into
 * the two roles HA conflates in `muted`:
 *
 *  - `intendedMute`: a one-way latch feeding ha-camera-stream's `muted` (HA's
 *    stream chooser). Seeded from the audio intent on a camera change, flipped
 *    to false the first time the visible leaf is unmuted, and never flipped
 *    back except on a camera change. Keeps muted views on the low-latency
 *    stream and prevents an autoplay force-mute from downgrading the stream.
 *  - `outputMute`: the visible leaf's real output mute, mirrored from the
 *    patch's mute-change event. The leaf players bind to this (not the latch),
 *    so a remount restores the real mute instead of the sticky latch value.
 *
 * See: https://github.com/dermotduffy/advanced-camera-card/issues/2479
 */
export class HAStreamMuteController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _options: HAStreamMuteControllerOptions;

  private _intendedMute = true;
  private _outputMute = true;

  // The camera entity the current state belongs to, to detect a camera change.
  private _cameraEntityID: string | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: HAStreamMuteControllerOptions,
  ) {
    this._host = host;
    this._options = options;
    host.addController(this);
  }

  public getIntendedMute(): boolean {
    return this._intendedMute;
  }

  public getOutputMute(): boolean {
    return this._outputMute;
  }

  public hostConnected(): void {
    this._host.addEventListener(
      HA_CAMERA_STREAM_MUTE_CHANGE_EVENT,
      this._muteChangeHandler,
    );
  }

  public hostDisconnected(): void {
    this._host.removeEventListener(
      HA_CAMERA_STREAM_MUTE_CHANGE_EVENT,
      this._muteChangeHandler,
    );
  }

  public hostUpdate(): void {
    // Reset only when the displayed camera changes, never on an intent change
    // alone: that would clobber a user's runtime unmute.
    const cameraEntityID = this._options.getCameraEntityID();
    if (cameraEntityID !== this._cameraEntityID) {
      this._cameraEntityID = cameraEntityID;
      this._intendedMute = !this._options.getPreferAudioStream();
      this._outputMute = true;
    }
  }

  private _muteChangeHandler = (ev: Event): void => {
    if (!isMuteChangeEvent(ev)) {
      return;
    }
    const muted = ev.detail.muted;

    let changed = false;
    if (muted !== this._outputMute) {
      this._outputMute = muted;
      changed = true;
    }

    // Unmuting flips the selection latch; muting never does (one-way).
    if (this._intendedMute && !muted) {
      this._intendedMute = false;
      changed = true;
    }

    if (changed) {
      this._host.requestUpdate();
    }
  };
}
