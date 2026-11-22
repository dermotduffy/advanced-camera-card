import type { MediaPlayerController, UnsubscribeCallback } from '../types';
import { onAbort } from '../utils/abort-signal';
import {
  sharedPreservedFrameStore,
  type PreservedFrame,
  type PreservedFrameKey,
  type PreservedFrameStore,
} from '../utils/preserved-frame-store';
import type { CardPreservedFrameAPI } from './types';

/**
 * Preserves the last frame of a camera's live media, so that frame can stand in
 * for the camera's image when the stream next loads.
 */
export class PreservedFrameManager {
  private _api: CardPreservedFrameAPI;
  private _store: PreservedFrameStore;

  // The preserved frame a player is showing for each camera ID.
  private _showingFrames = new Map<string, PreservedFrame>();

  constructor(api: CardPreservedFrameAPI, store?: PreservedFrameStore) {
    this._api = api;
    this._store = store ?? sharedPreservedFrameStore;
  }

  public get(cameraID: string): PreservedFrame | null {
    return this._store.get(this._getKey(cameraID), this._getMaxAgeSeconds(cameraID));
  }

  public has(cameraID: string): boolean {
    return !!this.get(cameraID);
  }

  public getSecondsUntilExpired(cameraID: string, frame: PreservedFrame): number {
    return this._store.getSecondsUntilExpired(frame, this._getMaxAgeSeconds(cameraID));
  }

  /**
   * Preserve the player's current frame as the camera's frame. Nothing is
   * preserved unless the camera's `image` config sets `preserve_frame_seconds`.
   */
  public async capture(cameraID: string, player: MediaPlayerController): Promise<void> {
    if (this._getMaxAgeSeconds(cameraID) <= 0) {
      return;
    }

    const date = new Date();
    const url = await player.getFrameURL(true);
    if (url) {
      this._store.set(this._getKey(cameraID), { url, date });
    }
  }

  /**
   * Call `callback` whenever a new frame is preserved for the camera, including
   * by another card that shares this card's frames.
   */
  public subscribe(cameraID: string, callback: () => void): UnsubscribeCallback {
    return this._store.subscribe((key) => {
      const ownKey = this._getKey(cameraID);
      if (key.cardID === ownKey.cardID && key.cameraID === ownKey.cameraID) {
        callback();
      }
    });
  }

  /** Record that a player is showing `frame` for the camera until `signal`
   * aborts. */
  public setShowing(cameraID: string, frame: PreservedFrame, signal: AbortSignal): void {
    this._showingFrames.set(cameraID, frame);
    this._api.getCardElementManager().update();

    onAbort(signal, () => {
      this._showingFrames.delete(cameraID);
      this._api.getCardElementManager().update();
    });
  }

  /** The preserved frame a player is showing for the camera, if any. */
  public getShowingFrame(cameraID: string): PreservedFrame | null {
    return this._showingFrames.get(cameraID) ?? null;
  }

  // The camera's own setting applies to every stream for the camera (i.e.
  // including substreams).
  private _getMaxAgeSeconds(cameraID: string): number {
    return (
      this._api.getCameraManager().getStore().getCamera(cameraID)?.getConfig().image
        .preserve_frame_seconds ?? 0
    );
  }

  private _getKey(cameraID: string): PreservedFrameKey {
    return {
      cardID: this._api.getConfigManager().getConfig()?.card_id,
      cameraID,
    };
  }
}
