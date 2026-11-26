import { LRUCache } from '../cache/lru';
import type { AdvancedCameraCardConfig } from '../config/schema/types';
import type { DataURL, UnsubscribeCallback } from '../types';

export interface PreservedFrame {
  url: DataURL;
  date: Date;
}

export interface PreservedFrameKey {
  // Cards without a `card_id` share frames for the same camera ID.
  cardID?: AdvancedCameraCardConfig['card_id'];
  cameraID: string;
}

export type PreservedFrameCallback = () => void;

// Arbitrary cap on how many frames to store. The LRU cache may hold up to twice
// this, so 16 frames at 4K is roughly 16-32MB (each a 1-2 MB `data:` URL).
const PRESERVED_FRAME_STORE_CAPACITY = 8;

/**
 * An in-memory store of the most recent frame for each card and camera. Frames
 * are lost when the page is closed or reloaded, and once the store is full, the
 * frames read or stored least recently are dropped first.
 */
export class PreservedFrameStore {
  private _frames = new LRUCache<string, PreservedFrame>(PRESERVED_FRAME_STORE_CAPACITY);
  private _callbacks = new Map<string, Set<PreservedFrameCallback>>();

  public get(key: PreservedFrameKey, maxAgeSeconds: number): PreservedFrame | null {
    const frame = this._frames.get(this._encodeKey(key));
    return frame && this.getSecondsUntilExpired(frame, maxAgeSeconds) > 0 ? frame : null;
  }

  public getSecondsUntilExpired(frame: PreservedFrame, maxAgeSeconds: number): number {
    return maxAgeSeconds - (new Date().getTime() - frame.date.getTime()) / 1000;
  }

  public set(key: PreservedFrameKey, frame: PreservedFrame): void {
    const encodedKey = this._encodeKey(key);
    const stored = this._frames.get(encodedKey);

    // A frame never replaces a newer one, e.g. when its encoding finishes after
    // that of a frame captured later.
    if (stored && stored.date > frame.date) {
      return;
    }

    if (stored?.url !== frame.url) {
      this._frames.set(encodedKey, frame);
      this._callbacks.get(encodedKey)?.forEach((callback) => callback());
    }
  }

  /** Call `callback` whenever a new frame is stored for `key`. */
  public subscribe(
    key: PreservedFrameKey,
    callback: PreservedFrameCallback,
  ): UnsubscribeCallback {
    const encodedKey = this._encodeKey(key);
    const callbacks = this._callbacks.get(encodedKey) ?? new Set();
    callbacks.add(callback);
    this._callbacks.set(encodedKey, callbacks);
    return () => {
      callbacks.delete(callback);
    };
  }

  private _encodeKey(key: PreservedFrameKey): string {
    return JSON.stringify([key.cardID, key.cameraID]);
  }
}

// Shared by every card on the page, since Home Assistant may rebuild a card
// (e.g. on a return to its dashboard) and the rebuilt card must be able to find
// its frames.
export const sharedPreservedFrameStore = new PreservedFrameStore();
