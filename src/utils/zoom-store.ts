import { LRUCache } from '../cache/lru';
import type { ZoomSettingsBase } from '../components-lib/zoom/types';

// The last zoom and pan of each camera's live view, to start from when a card
// is built again (e.g. on a return from another dashboard, when Home Assistant
// builds a new card element whose view context is empty). Kept in memory, one
// zoom per card and camera (see `encodeCardCameraKey`), for as long as the page
// stays open.

// As for preserved frames, an arbitrary cap, which the LRU cache may hold up to
// twice of.
const ZOOM_STORE_CAPACITY = 8;

export class ZoomStore {
  private _zooms = new LRUCache<string, ZoomSettingsBase>(ZOOM_STORE_CAPACITY);

  public get(key: string): ZoomSettingsBase | null {
    return this._zooms.get(key);
  }

  /** Keep a zoom under `key`, replacing the one before; null forgets it. */
  public set(key: string, zoom: ZoomSettingsBase | null): void {
    if (zoom) {
      this._zooms.set(key, { zoom: zoom.zoom, pan: { ...zoom.pan } });
    } else {
      this._zooms.delete(key);
    }
  }

  public clear(): void {
    this._zooms.clear();
  }
}

export const zoomStore = new ZoomStore();
