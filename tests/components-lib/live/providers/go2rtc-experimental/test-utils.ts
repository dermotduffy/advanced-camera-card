import { vi } from 'vitest';

import type {
  MediaSourceFactory,
  MediaSourceInterface,
} from '../../../../../src/components-lib/live/providers/go2rtc-experimental/adapters/media-source';
import type { StreamSourceChannel } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/types';
import type {
  BinaryCallback,
  Go2RTCMessage,
  MessageCallback,
} from '../../../../../src/go2rtc/messages';
import type { UnsubscribeCallback } from '../../../../../src/types';

// ===========================================================================
// User agents.
// ===========================================================================

export const CHROME_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const SAFARI_17_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.4 Safari/605.1.15';

// ===========================================================================
// Fakes for browser APIs jsdom does not provide.
// ===========================================================================

export const createTimeRanges = (ranges: [number, number][]): TimeRanges => ({
  length: ranges.length,
  start: (index: number) => ranges[index][0],
  end: (index: number) => ranges[index][1],
});

class FakeSourceBuffer extends EventTarget {
  public mode = '';
  public updating = false;
  public buffered: TimeRanges = createTimeRanges([]);

  public appendBuffer = vi.fn();
  public remove = vi.fn();

  public asSourceBuffer(): SourceBuffer {
    return this as unknown as SourceBuffer;
  }

  public fireUpdateEnd(): void {
    this.dispatchEvent(new Event('updateend'));
  }
}

// ===========================================================================
// Fakes for custom interfaces.
// ===========================================================================

export class FakeStreamSourceChannel implements StreamSourceChannel {
  public sent: Go2RTCMessage[] = [];
  public binaryCallback: BinaryCallback | null = null;

  private _messageCallbacks = new Set<MessageCallback>();

  public send(message: Go2RTCMessage): void {
    this.sent.push(message);
  }

  public subscribeToMessages(callback: MessageCallback): UnsubscribeCallback {
    this._messageCallbacks.add(callback);

    return () => {
      this._messageCallbacks.delete(callback);
    };
  }

  public setBinaryCallback(callback: BinaryCallback | null): void {
    this.binaryCallback = callback;
  }

  public receiveMessage(message: Go2RTCMessage): void {
    [...this._messageCallbacks].forEach((callback) => callback(message));
  }

  public getMessageCallbackCount(): number {
    return this._messageCallbacks.size;
  }
}

export class FakeMediaSourceInstance implements MediaSourceInterface {
  public sourceBuffer = new FakeSourceBuffer();

  public attach = vi.fn();
  public detach = vi.fn();
  public setLiveSeekableRange = vi.fn();
  public isOpen = vi.fn<() => boolean>(() => true);
  public isTypeSupported = vi.fn<(mimeType: string) => boolean>(() => true);
  public addSourceBuffer = vi.fn<(mimeType: string) => SourceBuffer>(() =>
    this.sourceBuffer.asSourceBuffer(),
  );

  private _sourceOpenCallbacks = new Set<() => void>();

  public subscribeToSourceOpen(callback: () => void): UnsubscribeCallback {
    this._sourceOpenCallbacks.add(callback);
    return () => {
      this._sourceOpenCallbacks.delete(callback);
    };
  }

  public fireSourceOpen(): void {
    [...this._sourceOpenCallbacks].forEach((callback) => callback());
  }

  public getSourceOpenCallbackCount(): number {
    return this._sourceOpenCallbacks.size;
  }
}

export const createFakeMediaSourceFactory = (
  instance: FakeMediaSourceInstance | null,
): MediaSourceFactory => vi.fn(() => instance);
