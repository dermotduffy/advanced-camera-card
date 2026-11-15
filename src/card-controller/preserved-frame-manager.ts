import type {
  MediaLoadedInfo,
  MediaPlayerController,
  UnsubscribeCallback,
} from '../types';
import {
  sharedDocumentVisibility,
  type DocumentVisibility,
} from '../utils/document-visibility';
import {
  sharedPreservedFrameStore,
  type PreservedFrameKey,
  type PreservedFrameStore,
} from '../utils/preserved-frame-store';
import type { MediaLoadedInfoChange } from './media-info-manager';
import type { CardPreservedFrameAPI } from './types';

interface PreservablePlayer {
  key: PreservedFrameKey;
  player: MediaPlayerController;
}

/**
 * Preserves the last frame of each media player, so that frame can stand in for
 * the camera's image when the stream next loads.
 *
 * A frame is captured when a player showing a camera goes away and when the
 * page as a whole is hidden (as at that point the player may lose its frame,
 * e.g. lazy-unloading).
 */
export class PreservedFrameManager {
  private _api: CardPreservedFrameAPI;
  private _store: PreservedFrameStore;
  private _documentVisibility: DocumentVisibility;

  // The player currently showing each preserved camera, by camera ID.
  private _players = new Map<string, PreservablePlayer>();

  private _unsubscribeDocumentVisibility: UnsubscribeCallback | null = null;
  private _unsubscribeMediaLoadedInfo: UnsubscribeCallback | null = null;

  constructor(
    api: CardPreservedFrameAPI,
    store?: PreservedFrameStore,
    documentVisibility?: DocumentVisibility,
  ) {
    this._api = api;
    this._store = store ?? sharedPreservedFrameStore;
    this._documentVisibility = documentVisibility ?? sharedDocumentVisibility;
  }

  public initialize(): void {
    this.uninitialize();

    this._unsubscribeDocumentVisibility = this._documentVisibility.subscribe((visible) =>
      this._handleDocumentVisibilityChange(visible),
    );
    this._unsubscribeMediaLoadedInfo = this._api
      .getMediaLoadedInfoManager()
      .subscribe((change) => this._handleMediaLoadedInfoChange(change));
  }

  public uninitialize(): void {
    this._unsubscribeDocumentVisibility?.();
    this._unsubscribeDocumentVisibility = null;
    this._unsubscribeMediaLoadedInfo?.();
    this._unsubscribeMediaLoadedInfo = null;
  }

  private _handleMediaLoadedInfoChange(change: MediaLoadedInfoChange): void {
    if (change.type === 'load') {
      this._handleLoad(change.targetID, change.info);
    } else if (change.type === 'unload') {
      this._handleUnload(change.targetID);
    }
  }

  private _handleLoad(targetID: string, info: MediaLoadedInfo): void {
    const player = info.mediaPlayerController;
    if (
      !player ||
      !this._api.getViewManager().getView()?.is('live') ||
      !this._api.getCameraManager().getStore().hasCameraID(targetID) ||
      !this._isPreserving(targetID)
    ) {
      return;
    }

    this._players.set(targetID, { player, key: this._getKey(targetID) });
  }

  private _handleUnload(targetID: string): void {
    const preservable = this._players.get(targetID);
    if (!preservable) {
      return;
    }
    this._players.delete(targetID);
    this._capture(preservable).catch(() => {});
  }

  private _handleDocumentVisibilityChange(visible: boolean): void {
    if (visible) {
      return;
    }

    for (const preservable of this._players.values()) {
      this._capture(preservable).catch(() => {});
    }
  }

  // The player draws its frame synchronously, while it still has its media.
  private async _capture(preservable: PreservablePlayer): Promise<void> {
    const capturedAt = new Date();
    const url = await preservable.player.getFrameURL(true);
    if (url) {
      this._store.set(preservable.key, { url, capturedAt });
    }
  }

  private _isPreserving(cameraID: string): boolean {
    const cameraImageConfig = this._api
      .getCameraManager()
      .getStore()
      .getCamera(cameraID)
      ?.getConfig().image;
    const cardImageConfig = this._api.getConfigManager().getConfig()?.image;
    return (
      (cameraImageConfig?.preserve_frame_seconds ?? 0) > 0 ||
      (cardImageConfig?.preserve_frame_seconds ?? 0) > 0
    );
  }

  private _getKey(cameraID: string): PreservedFrameKey {
    return {
      cardID: this._api.getConfigManager().getConfig()?.card_id,
      cameraID,
    };
  }
}
