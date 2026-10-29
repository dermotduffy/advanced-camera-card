import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { CameraManager } from '../camera-manager/manager.js';
import { Generation } from '../utils/concurrency/generation.js';
import type { ViewMedia } from '../view/item.js';
import { getMediaSeekTarget } from '../view/media-seek-target.js';
import type { View } from '../view/view.js';

interface MediaStartPositionControllerOptions {
  cameraManager?: CameraManager;
  view?: View | null;

  // The media to compute a start position for, or `null` when there is nothing
  // to compute (e.g. the host is not yet showing this media, or will not play
  // it with a player that can start part way through).
  media?: ViewMedia | null;
}

/**
 * Computes where playback of a media item should start (seconds from the start
 * of the media), so the player can start loading there rather than loading the
 * start of the media only for the viewer to seek away from it.
 *
 * The position is computed once per media content: later seeks are the job of
 * the viewer, which seeks the loaded player, and recomputing here would hold
 * back a player that has already started.
 */
export class MediaStartPositionController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _getOptionsCallback: () => MediaStartPositionControllerOptions;

  private _value: number | null = null;
  private _resolved = false;

  // The content of the last request.
  private _targetContentID: string | null = null;

  private _requestGeneration = new Generation();

  constructor(
    host: ReactiveControllerHost,
    getOptionsCallback: () => MediaStartPositionControllerOptions,
  ) {
    (this._host = host).addController(this);
    this._getOptionsCallback = getOptionsCallback;
  }

  public getValue(): number | null {
    return this._value;
  }

  // Whether the position for the current media has been computed. A computed
  // position may still be `null`: start from the beginning.
  public hasResolved(): boolean {
    return this._resolved;
  }

  public hostDisconnected(): void {
    this._reset();
  }

  public async hostUpdate(): Promise<void> {
    const { cameraManager, view, media } = this._getOptionsCallback();
    const contentID = media?.getContentID() ?? null;

    if (!media || !contentID) {
      this._reset();
      return;
    }

    if (contentID === this._targetContentID) {
      return;
    }

    this._targetContentID = contentID;
    this._value = null;
    this._resolved = false;

    // Without a position the player starts from the beginning, as it would
    // without this controller: a player must never wait on a position that
    // cannot be computed.
    const seek = getMediaSeekTarget(view ?? null, media);
    if (!cameraManager || !seek?.inMedia) {
      this._requestGeneration.invalidate();
      this._resolved = true;
      return;
    }

    const requestID = this._requestGeneration.next();
    let value: number | null = null;
    try {
      value = await cameraManager.getMediaSeekTime(media, seek.time);
    } catch {
      // Starting from the beginning is the fallback: the viewer still seeks
      // once the media has loaded.
    }

    if (!this._requestGeneration.isCurrent(requestID)) {
      return;
    }

    this._value = value;
    this._resolved = true;
    this._host.requestUpdate();
  }

  private _reset(): void {
    // Invalidate any in-flight request so a stale result cannot repopulate the
    // controller after the inputs have been cleared.
    this._requestGeneration.invalidate();
    this._value = null;
    this._resolved = false;
    this._targetContentID = null;
  }
}
