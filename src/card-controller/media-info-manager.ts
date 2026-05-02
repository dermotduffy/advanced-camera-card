import {
  MediaLoadedInfo,
  MediaLoadedInfoEventDetail,
  MediaLoadedInfoOwner,
} from '../types';
import { onAbort } from '../utils/abort-signal';
import { log } from '../utils/debug';
import { isValidMediaLoadedInfo } from '../utils/media-info';
import { CardMediaLoadedAPI } from './types';

interface ActiveEntry {
  info: MediaLoadedInfo;
  owner: MediaLoadedInfoOwner;
}

export class MediaLoadedInfoManager {
  private _api: CardMediaLoadedAPI;

  // Active load per target: present iff a load is currently registered for that
  // target. `owner` tags who set it so a late clear from a stale source (an
  // element that's since been replaced) is a no-op. Keyed by targetID
  // (see:`src/view/target-id.ts`).
  private _active: Map<string, ActiveEntry> = new Map();

  // The last `info` ever seen per target, surviving transient unloads so
  // consumers can retrieve the last-seen info after disconnect. Latch-only:
  // never cleared by `clear` / `_clearTarget`, only by `initialize`.
  private _lastKnown: Map<string, MediaLoadedInfo> = new Map();

  // The currently "active" target — the one whose info drives condition state
  // and card-level side effects. Driven by ViewManager on every view change.
  private _selected: string | null = null;

  constructor(api: CardMediaLoadedAPI) {
    this._api = api;
  }

  public initialize(): void {
    this._active.clear();
    this._lastKnown.clear();
    this._selected = null;
    this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
  }

  public set(mediaLoadedInfo: MediaLoadedInfo, owner: MediaLoadedInfoOwner): void {
    if (!isValidMediaLoadedInfo(mediaLoadedInfo) || !mediaLoadedInfo.targetID) {
      return;
    }

    const targetID = mediaLoadedInfo.targetID;
    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Advanced Camera Card media load [target_id=${targetID}]: `,
      mediaLoadedInfo,
    );

    this._active.set(targetID, { info: mediaLoadedInfo, owner });
    this._lastKnown.set(targetID, mediaLoadedInfo);

    if (targetID === this._selected) {
      this._emitChange(mediaLoadedInfo);
    }
  }

  public setSelected(targetID: string | null): void {
    if (this._selected === targetID) {
      return;
    }

    this._selected = targetID;
    this._emitChange(targetID ? this._active.get(targetID)?.info ?? null : null);
  }

  public get(): MediaLoadedInfo | null {
    return this._selected ? this._active.get(this._selected)?.info ?? null : null;
  }

  public has(): boolean {
    return !!this.get();
  }

  public getLastKnown(): MediaLoadedInfo | null {
    return this._selected ? this._lastKnown.get(this._selected) ?? null : null;
  }

  public handleLoadEvent(ev: CustomEvent<MediaLoadedInfoEventDetail>): void {
    // path[0] = the source-controller's host that dispatched the load; we use
    // it as the ownership token so a late clear from a disconnected element
    // can't blow away an entry that's since been overwritten by another host.
    const owner = ev.composedPath()[0];
    const targetID = ev.detail.info.targetID;
    if (!(owner instanceof HTMLElement) || !targetID) {
      return;
    }
    this.set(ev.detail.info, owner);
    onAbort(ev.detail.signal, () => this._clearTarget(targetID, owner));
  }

  public clear(): void {
    const selectedHadInfo = !!this._selected && this._active.has(this._selected);
    this._active.clear();
    if (selectedHadInfo) {
      this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
    }
  }

  private _clearTarget(targetID: string, owner: MediaLoadedInfoOwner): void {
    if (this._active.get(targetID)?.owner !== owner) {
      return;
    }

    this._active.delete(targetID);

    if (targetID === this._selected) {
      this._api.getConditionStateManager().setState({ mediaLoadedInfo: null });
    }
  }

  private _emitChange(mediaLoadedInfo: MediaLoadedInfo | null): void {
    this._api.getConditionStateManager().setState({ mediaLoadedInfo });
    this._api.getStyleManager().setExpandedMode();
    this._api.getCardElementManager().update();
  }
}
