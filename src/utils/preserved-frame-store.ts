import { LRUCache } from '../cache/lru';
import type { DataURL, UnsubscribeCallback } from '../types';

export interface PreservedFrame {
  url: DataURL;
  capturedAt: Date;
}

export interface PreservedFrameKey {
  // Cards without a `card_id` share frames for the same camera ID.
  cardID?: string;
  cameraID: string;
}

type PreservedFrameStoreCallback = (key: PreservedFrameKey) => void;

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
  private _callbacks = new Set<PreservedFrameStoreCallback>();

  /** The frame under `key`, unless it is `maxAgeSeconds` old or older. */
  public get(key: PreservedFrameKey, maxAgeSeconds: number): PreservedFrame | null {
    const frame = this._frames.get(this._encodeKey(key));
    if (!frame) {
      return null;
    }
    const age = new Date().getTime() - frame.capturedAt.getTime();
    return age < maxAgeSeconds * 1000 ? frame : null;
  }

  /**
   * Keep a frame under `key`, unless a frame captured at the same time or later
   * is already kept there. Subscribers hear of a kept frame.
   */
  public set(key: PreservedFrameKey, frame: PreservedFrame): void {
    const encodedKey = this._encodeKey(key);
    const existing = this._frames.get(encodedKey);
    if (existing && existing.capturedAt >= frame.capturedAt) {
      return;
    }

    this._frames.set(encodedKey, frame);
    [...this._callbacks].forEach((callback) => callback(key));
  }

  public subscribe(callback: PreservedFrameStoreCallback): UnsubscribeCallback {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  private _encodeKey(key: PreservedFrameKey): string {
    return JSON.stringify([key.cardID, key.cameraID]);
  }
}

// Shared by every card on the page, since Home Assistant may rebuild a card
// (e.g. on a return to its dashboard) and the rebuilt card must be able to find
// its frames.
export const sharedPreservedFrameStore = new PreservedFrameStore();
