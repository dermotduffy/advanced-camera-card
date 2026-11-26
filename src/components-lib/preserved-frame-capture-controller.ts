import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { PreservedFrameManager } from '../card-controller/preserved-frame-manager';
import type {
  MediaLoadedInfo,
  MediaLoadedInfoEventDetail,
  UnsubscribeCallback,
} from '../types';
import { onAbort } from '../utils/abort-signal';
import {
  sharedDocumentVisibility,
  type DocumentVisibility,
} from '../utils/document-visibility';

interface PreservedFrameCaptureControllerOptions {
  getManager: () => PreservedFrameManager | null;
  getMediaLoadedInfo: () => MediaLoadedInfo | null;

  documentVisibility?: DocumentVisibility;
}

/**
 * Preserves the last frame of the media that is about to be hidden/unloaded.
 */
export class PreservedFrameCaptureController implements ReactiveController {
  private _options: PreservedFrameCaptureControllerOptions;
  private _documentVisibility: DocumentVisibility;

  private _unsubscribeDocumentVisibility: UnsubscribeCallback | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: PreservedFrameCaptureControllerOptions,
  ) {
    this._options = options;
    this._documentVisibility = options.documentVisibility ?? sharedDocumentVisibility;

    host.addEventListener('advanced-camera-card:media:loaded', this._handleMediaLoaded);
    host.addController(this);
  }

  public hostConnected(): void {
    this._unsubscribeDocumentVisibility = this._documentVisibility.subscribe(
      (visible) => {
        if (!visible) {
          this._capture(this._options.getMediaLoadedInfo());
        }
      },
    );
  }

  public hostDisconnected(): void {
    this._unsubscribeDocumentVisibility?.();
    this._unsubscribeDocumentVisibility = null;
  }

  private _handleMediaLoaded = (ev: CustomEvent<MediaLoadedInfoEventDetail>): void => {
    const info = ev.detail.info;
    onAbort(ev.detail.signal, () => this._capture(info));
  };

  private _capture(info: MediaLoadedInfo | null): void {
    const manager = this._options.getManager();
    if (!manager || !info?.targetID || !info.mediaPlayerController) {
      return;
    }

    manager.capture(info.targetID, info.mediaPlayerController).catch(() => {});
  }
}
