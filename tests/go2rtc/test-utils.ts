import { vi, type Mock } from 'vitest';

// ===========================================================================
// Fakes for browser APIs jsdom does not provide.
// ===========================================================================

export class FakeWebSocket extends EventTarget {
  public binaryType = '';
  public sent: string[] = [];

  public close = vi.fn();
  public send = vi.fn((data: string): void => {
    this.sent.push(data);
  });

  public asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }

  public fireOpen(): void {
    this.dispatchEvent(new Event('open'));
  }

  public fireClose(): void {
    this.dispatchEvent(new Event('close'));
  }

  public fireMessage(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

export class FakeMediaStreamTrack extends EventTarget {
  public muted = false;
  public readyState: MediaStreamTrackState = 'live';
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
