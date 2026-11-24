import { LRUCache } from '../cache/lru';
import type { DataURL, UnsubscribeCallback } from '../types';
import { encodeCardCameraKey, type CardCameraKey } from './card-camera-key';

export interface PreservedFrame {
  url: DataURL;
  date: Date;
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

  public get(key: CardCameraKey, maxAgeSeconds: number): PreservedFrame | null {
    const frame = this._frames.get(encodeCardCameraKey(key));
    return frame && this.getSecondsUntilExpired(frame, maxAgeSeconds) > 0 ? frame : null;
  }

  public getSecondsUntilExpired(frame: PreservedFrame, maxAgeSeconds: number): number {
    return maxAgeSeconds - (new Date().getTime() - frame.date.getTime()) / 1000;
  }

  public set(key: CardCameraKey, frame: PreservedFrame): void {
    const encodedKey = encodeCardCameraKey(key);
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
    key: CardCameraKey,
    callback: PreservedFrameCallback,
  ): UnsubscribeCallback {
    const encodedKey = encodeCardCameraKey(key);
    const callbacks = this._callbacks.get(encodedKey) ?? new Set();
    callbacks.add(callback);
    this._callbacks.set(encodedKey, callbacks);
    return () => {
      callbacks.delete(callback);
    };
  }
}

// Shared by every card on the page, since Home Assistant may rebuild a card
// (e.g. on a return to its dashboard) and the rebuilt card must be able to find
// its frames.
export const sharedPreservedFrameStore = new PreservedFrameStore();
