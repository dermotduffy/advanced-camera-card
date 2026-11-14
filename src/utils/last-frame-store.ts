import type { CameraConfig } from '../config/schema/cameras.js';

// The last frame captured of each camera's live stream (image mode
// `last_frame`), shown in place of the stock image the next time the camera
// loads. Kept in memory, one frame per camera (each capture replaces it), for
// as long as the page stays open and the frame is not older than its maximum
// age.

export interface LastFrame {
  // A `data:` URL of the captured image.
  url: string;
  capturedAt: Date;
}

interface StoredLastFrame extends LastFrame {
  // When the frame stops being shown (ms since the epoch).
  expiresAt: number;
}

type LastFrameListener = (key: string) => void;

/**
 * The key a camera's frame is kept under: its ID and its configuration. The
 * store is shared by every card on the page, so a card rebuilt with the same
 * camera (e.g. on a return from another dashboard) finds its frame again, while
 * two cards that give different cameras the same `id` do not share one.
 */
export const getLastFrameKey = (
  cameraID: string,
  cameraConfig?: CameraConfig | null,
): string => (cameraConfig ? `${cameraID}\n${JSON.stringify(cameraConfig)}` : cameraID);

interface LastFrameTimeLocale {
  language?: string;
  // Home Assistant's time format: `12`, `24`, or that of the language or the
  // system.
  time_format?: string;
}

/**
 * When a last frame was captured: the time, with the date if not today, in
 * the user's time format.
 */
export const formatLastFrameTime = (
  capturedAt: Date,
  locale?: LastFrameTimeLocale,
  now: Date = new Date(),
): string => {
  const sameDay = capturedAt.toDateString() === now.toDateString();
  const hour12 =
    locale?.time_format === '12' ? true : locale?.time_format === '24' ? false : null;
  return capturedAt.toLocaleString(
    locale?.time_format === 'system' ? undefined : locale?.language,
    {
      ...(!sameDay && { day: 'numeric', month: 'short' }),
      hour: '2-digit',
      minute: '2-digit',
      ...(hour12 !== null && { hour12 }),
    },
  );
};

export class LastFrameStore {
  private _frames = new Map<string, StoredLastFrame>();
  private _listeners = new Set<LastFrameListener>();

  /** The frame kept under `key`, unless it has expired (it is then dropped). */
  public get(key: string): LastFrame | null {
    const frame = this._frames.get(key);
    if (frame && frame.expiresAt <= Date.now()) {
      this._frames.delete(key);
      return null;
    }
    return frame ?? null;
  }

  /**
   * Keep a frame under `key`, replacing the one before, until it is
   * `maxAgeSeconds` old. Frames that have expired meanwhile are dropped.
   * Listeners hear of it.
   */
  public set(key: string, frame: LastFrame, maxAgeSeconds: number): void {
    const now = Date.now();
    for (const [otherKey, other] of this._frames) {
      if (other.expiresAt <= now) {
        this._frames.delete(otherKey);
      }
    }
    this._frames.set(key, {
      ...frame,
      expiresAt: frame.capturedAt.getTime() + maxAgeSeconds * 1000,
    });
    this._notify(key);
  }

  public subscribe(listener: LastFrameListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(key: string): void {
    for (const listener of this._listeners) {
      listener(key);
    }
  }
}

export const lastFrameStore = new LastFrameStore();
