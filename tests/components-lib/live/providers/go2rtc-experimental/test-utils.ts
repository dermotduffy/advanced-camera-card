import { vi, type Mock } from 'vitest';

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

export class FakeMediaStreamTrack extends EventTarget {
  public muted = false;
  public kind: string;

  constructor(kind: string) {
    super();
    this.kind = kind;
  }

  public asTrack(): MediaStreamTrack {
    return this as unknown as MediaStreamTrack;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.dispatchEvent(new Event(muted ? 'mute' : 'unmute'));
  }
}

export class FakeMediaStream {
  private _tracks: FakeMediaStreamTrack[];

  constructor(tracks: FakeMediaStreamTrack[] = []) {
    this._tracks = tracks;
  }

  public getTracks(): FakeMediaStreamTrack[] {
    return this._tracks;
  }

  public getVideoTracks(): FakeMediaStreamTrack[] {
    return this._tracks.filter((track) => track.kind === 'video');
  }

  public getAudioTracks(): FakeMediaStreamTrack[] {
    return this._tracks.filter((track) => track.kind === 'audio');
  }

  public asMediaStream(): MediaStream {
    return this as unknown as MediaStream;
  }
}

class FakeRTCTransceiver {
  public direction: string;
  public currentDirection: string;
  public sender: {
    track: FakeMediaStreamTrack | null;
    replaceTrack: Mock<(track: MediaStreamTrack | null) => Promise<void>>;
  };
  public receiver: { track: FakeMediaStreamTrack };

  constructor(direction: string, kind: string, track: FakeMediaStreamTrack | null) {
    this.direction = direction;
    this.currentDirection = direction;
    this.sender = {
      track,
      replaceTrack: vi.fn<(track: MediaStreamTrack | null) => Promise<void>>(() =>
        Promise.resolve(),
      ),
    };
    this.receiver = { track: new FakeMediaStreamTrack(kind) };
  }
}

export class FakeRTCPeerConnection extends EventTarget {
  public connectionState: RTCPeerConnectionState = 'new';
  public remoteDescription: { sdp: string } | null = null;
  public transceivers: FakeRTCTransceiver[] = [];

  public createOffer = vi.fn(
    (): Promise<{ type: string; sdp?: string }> =>
      Promise.resolve({ type: 'offer', sdp: 'v=0\r\noffer' }),
  );
  public setLocalDescription = vi.fn(() => Promise.resolve());
  public setRemoteDescription = vi.fn((description: { sdp: string }) => {
    this.remoteDescription = description;
    return Promise.resolve();
  });
  public addIceCandidate = vi.fn(() => Promise.resolve());
  public close = vi.fn();

  public addTransceiver(
    trackOrKind: FakeMediaStreamTrack | string,
    init: { direction: string },
  ): FakeRTCTransceiver {
    const kind = typeof trackOrKind === 'string' ? trackOrKind : trackOrKind.kind;
    const track = typeof trackOrKind === 'string' ? null : trackOrKind;
    const transceiver = new FakeRTCTransceiver(init.direction, kind, track);
    this.transceivers.push(transceiver);
    return transceiver;
  }

  public getTransceivers(): FakeRTCTransceiver[] {
    return this.transceivers;
  }

  public getReceivers(): { track: FakeMediaStreamTrack }[] {
    return this.transceivers.map((transceiver) => transceiver.receiver);
  }

  public asPeerConnection(): RTCPeerConnection {
    return this as unknown as RTCPeerConnection;
  }

  public getMicrophoneTransceiver(): FakeRTCTransceiver {
    return this.transceivers[0];
  }

  public fireConnectionStateChange(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    this.dispatchEvent(new Event('connectionstatechange'));
  }

  public fireIceCandidate(candidate: string | null): void {
    const event = new Event('icecandidate');
    Object.assign(event, {
      candidate: candidate === null ? null : { candidate },
    });
    this.dispatchEvent(event);
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
