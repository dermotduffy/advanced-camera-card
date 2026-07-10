// Wraps the browser's two incompatible MediaSource "flavors" behind one
// interface, so mse.ts stays flavor-agnostic (and mockable in tests):
//   - classic MediaSource (Chrome/Firefox/desktop): attach via an object URL
//     on `video.src`.
//   - ManagedMediaSource (Safari/iOS 17+; iOS had no MediaSource at all before
//     then): attach via `video.srcObject`, and needs `disableRemotePlayback`.
import type { UnsubscribeCallback } from '../../../../../types';

declare global {
  interface Window {
    // Safari 17+ managed variant of MediaSource; API-compatible for the
    // subset used here.
    ManagedMediaSource?: typeof MediaSource;
  }
}

// The unified MediaSource surface mse.ts programs against; the flavor-specific
// attach/detach lives in the implementations below.
export interface MediaSourceInterface {
  attach(video: HTMLVideoElement): void;
  detach(video: HTMLVideoElement): void;

  // Fires once the source is ready to accept SourceBuffers; nothing can be
  // appended before it.
  subscribeToSourceOpen(callback: () => void): UnsubscribeCallback;

  // Creates the SourceBuffer that media chunks are appended to, configured for
  // the given codec MIME string.
  addSourceBuffer(codecs: string): SourceBuffer;

  // Declares the seekable live window to the browser, which cannot infer it for
  // an open-ended live source.
  setLiveSeekableRange(startSeconds: number, endSeconds: number): void;

  // Whether a codec MIME string is playable.
  isTypeSupported(mimeType: string): boolean;
}

// Creates a wrapped MediaSource, or null when the browser supports no variant.
export type MediaSourceFactory = () => MediaSourceInterface | null;

abstract class MediaSourceInstanceBase implements MediaSourceInterface {
  protected _mediaSource: MediaSource;

  constructor(mediaSource: MediaSource) {
    this._mediaSource = mediaSource;
  }

  public abstract attach(video: HTMLVideoElement): void;
  public abstract detach(video: HTMLVideoElement): void;
  public abstract isTypeSupported(mimeType: string): boolean;

  public subscribeToSourceOpen(callback: () => void): UnsubscribeCallback {
    this._mediaSource.addEventListener('sourceopen', callback);
    return () => this._mediaSource.removeEventListener('sourceopen', callback);
  }

  public addSourceBuffer(codecs: string): SourceBuffer {
    return this._mediaSource.addSourceBuffer(codecs);
  }

  public setLiveSeekableRange(startSeconds: number, endSeconds: number): void {
    this._mediaSource.setLiveSeekableRange(startSeconds, endSeconds);
  }
}

class ManagedMediaSourceInstance extends MediaSourceInstanceBase {
  private _mediaSourceConstructor: typeof MediaSource;

  constructor(mediaSourceConstructor: typeof MediaSource) {
    super(new mediaSourceConstructor());
    this._mediaSourceConstructor = mediaSourceConstructor;
  }

  public attach(video: HTMLVideoElement): void {
    // ManagedMediaSource does not deliver data while remote playback (e.g.
    // AirPlay) is possible.
    video.disableRemotePlayback = true;
    video.srcObject = this._mediaSource;
  }

  public detach(video: HTMLVideoElement): void {
    video.srcObject = null;
  }

  public isTypeSupported(mimeType: string): boolean {
    return this._mediaSourceConstructor.isTypeSupported(mimeType);
  }
}

class ClassicMediaSourceInstance extends MediaSourceInstanceBase {
  private _objectURL: string | null = null;

  constructor() {
    super(new MediaSource());
  }

  public attach(video: HTMLVideoElement): void {
    this._objectURL = URL.createObjectURL(this._mediaSource);

    // The object URL is only needed until the browser has opened the media
    // source.
    this._mediaSource.addEventListener('sourceopen', () => this._revokeObjectURL(), {
      once: true,
    });

    video.src = this._objectURL;
    video.srcObject = null;
  }

  public detach(video: HTMLVideoElement): void {
    video.src = '';
    this._revokeObjectURL();
  }

  public isTypeSupported(mimeType: string): boolean {
    return MediaSource.isTypeSupported(mimeType);
  }

  private _revokeObjectURL(): void {
    if (this._objectURL) {
      URL.revokeObjectURL(this._objectURL);
      this._objectURL = null;
    }
  }
}

export const createBrowserMediaSource: MediaSourceFactory = () => {
  // Safari exposes both flavors, so check Managed first and prefer it there: it
  // lets the browser throttle buffering to save battery and memory and hands
  // off cleanly to AirPlay, which classic MediaSource does not. Classic is the
  // fallback for other browsers.
  const managedMediaSource = window.ManagedMediaSource;
  if (managedMediaSource) {
    return new ManagedMediaSourceInstance(managedMediaSource);
  }
  if ('MediaSource' in window) {
    return new ClassicMediaSourceInstance();
  }
  return null;
};
