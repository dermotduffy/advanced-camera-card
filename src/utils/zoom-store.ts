import type { ZoomSettingsBase } from '../components-lib/zoom/types.js';
import type { AdvancedCameraCardConfig } from '../config/schema/types.js';

// The last zoom and pan of each camera's live view, to start from when a card
// is built again (e.g. on a return from another dashboard, when Home Assistant
// builds a new card element whose view context is empty). Kept in memory, one
// zoom per card and camera, for as long as the page stays open.

export interface ZoomKey {
  // As for preserved frames: cards without a `card_id` share the zoom of the
  // same camera ID.
  cardID?: AdvancedCameraCardConfig['card_id'];
  cameraID: string;
}

/** The key a camera's zoom is kept under (a string, so it compares by value). */
export const getZoomKey = (key: ZoomKey): string =>
  JSON.stringify([key.cardID, key.cameraID]);

export class ZoomStore {
  private _zooms = new Map<string, ZoomSettingsBase>();

  public get(key: string): ZoomSettingsBase | null {
    return this._zooms.get(key) ?? null;
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
