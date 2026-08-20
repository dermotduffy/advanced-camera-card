import {
  isServerErrorForMode,
  type Go2RTCMessage,
} from '../../../../../go2rtc/messages';
import {
  createBrowserPeerConnection,
  GO2RTC_PEER_CONNECTION_CONFIG,
  type PeerConnectionFactory,
} from '../../../../../go2rtc/peer-connection';
import type {
  MediaLoadedCapabilities,
  MediaTechnology,
  UnsubscribeCallback,
} from '../../../../../types';
import { has2WayAudio, hasAudio } from '../../../../../utils/audio';
import { isRecord } from '../../../../../utils/basic';
import { Timer } from '../../../../../utils/timer';
import type {
  StreamProfile,
  StreamSource,
  StreamSourceContext,
  VideoStreamTarget,
} from '../types';
import { sdpHasH265 } from '../utils/webrtc-sdp';

// ===========================================================================
// WebRTC Tuning
// ===========================================================================

// Fail if no decoded frame arrives within this window. Covers the case where
// ICE connects and packets flow but frames never decode (the connection looks
// healthy yet nothing plays), so the session can fall back instead of hanging.
// See https://github.com/dermotduffy/advanced-camera-card/issues/1699
// The window length is a tuning value, not derived: long enough to avoid
// failing a slow-but-healthy start, short enough to fall back promptly.
const WEBRTC_CONNECT_TIMEOUT_SECONDS = 5;

// ===========================================================================
// WebRTCStreamSource
// ===========================================================================

export type MediaStreamFactory = (tracks: MediaStreamTrack[]) => MediaStream;

// What a thrown value has to say for itself, preferring the browser's sentence
// ("The peer connection is closed") over the bare type name
// ("InvalidStateError"), which means nothing to the person reading it.
//
// DOMException may not inherit from Error, and catch blocks may be handed
// anything, so extract details structurally rather than using `instanceof
// Error`.
const getErrorDescription = (error: unknown): string | null => {
  if (!isRecord(error)) {
    return null;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  const name = typeof error.name === 'string' ? error.name : '';
  return message || name || null;
};

interface WebRTCStreamSourceOptions {
  createPeerConnection?: PeerConnectionFactory;
  createMediaStream?: MediaStreamFactory;
  microphoneStream?: MediaStream | null;

  // The outbound microphone track could not be attached. Separate from the
  // stream-source failure channel: a microphone that cannot attach says nothing
  // about the inbound video which keeps playing. `error` is what the browser
  // said went wrong, when it said anything.
  microphoneErrorCallback?: (error?: string) => void;
}

export class WebRTCStreamSource implements StreamSource {
  private _context: StreamSourceContext<VideoStreamTarget>;
  private _stream: MediaStream | null = null;
  private _pc: RTCPeerConnection | null = null;

  private _createPeerConnection: PeerConnectionFactory;
  private _createMediaStream: MediaStreamFactory;
  private _microphoneStream: MediaStream | null;
  private _microphoneErrorCallback: ((error?: string) => void) | null;

  private _microphoneTransceiver: RTCRtpTransceiver | null = null;

  private _connectTimer = new Timer();

  private _unsubscribeCallbacks: UnsubscribeCallback[] = [];

  private _loadedHandler = (): void => {
    this._connectTimer.stop();
    this._context.callbacks.loadedCallback();
  };

  constructor(
    context: StreamSourceContext<VideoStreamTarget>,
    options?: WebRTCStreamSourceOptions,
  ) {
    this._context = context;
    this._createPeerConnection =
      options?.createPeerConnection ?? createBrowserPeerConnection;
    this._createMediaStream =
      options?.createMediaStream ?? ((tracks) => new MediaStream(tracks));

    this._microphoneStream = options?.microphoneStream ?? null;
    this._microphoneErrorCallback = options?.microphoneErrorCallback ?? null;
  }

  public start(): void {
    const pc = this._createPeerConnection(GO2RTC_PEER_CONNECTION_CONFIG);
    this._pc = pc;

    // Always pre-arm exactly one outbound audio slot so the microphone track
    // can be attached later via `replaceTrack` with no renegotiation. The
    // kind-only `addTransceiver('audio', ...)` form never calls getUserMedia,
    // so it never raises permission prompt for users.
    const microphoneTrack = this._microphoneStream?.getAudioTracks()[0] ?? null;
    this._microphoneTransceiver = pc.addTransceiver(microphoneTrack ?? 'audio', {
      direction: 'sendonly',
    });
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    pc.addEventListener('icecandidate', (ev) => {
      // A late candidate from a superseded connection (e.g. after stop(), if
      // WebRTC has lost the race) must not send on the channel a binary lane
      // may still be using.
      if (this._pc !== pc) {
        return;
      }

      // An empty value signals end-of-candidates, which the server accepts.
      this._context.channel.send({
        type: 'webrtc/candidate',
        value: ev.candidate ? ev.candidate.candidate : '',
      });
    });
    pc.addEventListener('connectionstatechange', () =>
      this._handleConnectionStateChange(pc),
    );

    this._unsubscribeCallbacks.push(
      this._context.channel.subscribeToMessages((message) =>
        this._handleMessage(pc, message),
      ),
    );

    this._connectTimer.start(WEBRTC_CONNECT_TIMEOUT_SECONDS, () =>
      this._context.callbacks.failedCallback('connect_timeout'),
    );

    this._negotiate(pc).catch(() => {
      // A rejection from a superseded connection (e.g. after `stop`) is not
      // this source's concern.
      if (this._pc === pc) {
        this._context.callbacks.failedCallback('media_error');
      }
    });
  }

  public stop(): void {
    this._connectTimer.stop();

    this._unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this._unsubscribeCallbacks = [];

    this._context.target.video.removeEventListener('loadeddata', this._loadedHandler);
    if (this._pc) {
      // pc.close() does not stop the sender's tracks, so the outbound microphone
      // track keeps running. That is deliberate: MicrophoneManager owns the mic
      // (it is shared across cameras), so stopping it here would break it
      // elsewhere -- do not add a track.stop() here. See
      // https://github.com/dermotduffy/advanced-camera-card/issues/1810
      this._pc.close();
      this._pc = null;
    }

    // The transceiver belonged to the now-closed peer connection.
    this._microphoneTransceiver = null;
    this._context.target.video.srcObject = null;
    this._stream = null;
  }

  public getMediaStream(): MediaStream | null {
    return this._stream;
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this._pc;
  }

  public getCapabilities(): MediaLoadedCapabilities {
    return {
      supportsPause: true,
      hasAudio: hasAudio(this._context.target.video, { pc: this._pc }),
      has2WayAudio: has2WayAudio(this._pc),
    };
  }

  public getTechnology(): MediaTechnology[] {
    return ['webrtc'];
  }

  public getStreamProfile(): StreamProfile {
    const sdp = this._pc?.remoteDescription?.sdp ?? null;

    return {
      hasVideo: (this._stream?.getVideoTracks().length ?? 0) > 0,
      hasH265Video: sdp ? sdpHasH265(sdp) : false,
      hasAudio: (this._stream?.getAudioTracks().length ?? 0) > 0,
      hasAACAudio: false,
    };
  }

  // Swap the outbound microphone track without renegotiating.
  public async setMicrophoneStream(stream: MediaStream | null): Promise<void> {
    if (this._microphoneStream === stream) {
      return;
    }
    this._microphoneStream = stream;

    const transceiver = this._microphoneTransceiver;
    if (!transceiver) {
      // No peer connection yet; the next `start()` reads the current stream and
      // pre-arms the transceiver with it.
      return;
    }

    // Whether the awaited microphone request is still the one in effect: a newer
    // stream, or teardown, retires it, and reporting a retired outcome would
    // describe something that is no longer being attempted.
    const isCurrentRequest = (
      transceiver: RTCRtpTransceiver,
      stream: MediaStream | null,
    ): boolean =>
      transceiver === this._microphoneTransceiver &&
      this._microphoneStream === stream &&
      this._pc !== null;

    // A microphone stream carries a single audio track; null detaches the sender.
    const desiredTrack = stream?.getAudioTracks()[0] ?? null;
    try {
      await transceiver.sender.replaceTrack(desiredTrack);
    } catch (error) {
      // Only a failed attach is reported. A failed detach leaves nothing for
      // the user to act on: the track stops being transmitted when the peer
      // connection closes.
      if (desiredTrack && isCurrentRequest(transceiver, stream)) {
        this._microphoneErrorCallback?.(getErrorDescription(error) ?? undefined);
      }
    }
  }

  private async _negotiate(pc: RTCPeerConnection): Promise<void> {
    const offer = await pc.createOffer();
    if (this._pc !== pc) {
      return;
    }

    await pc.setLocalDescription(offer);
    if (this._pc !== pc) {
      return;
    }

    this._context.channel.send({ type: 'webrtc/offer', value: offer.sdp ?? '' });
  }

  private _handleMessage(pc: RTCPeerConnection, message: Go2RTCMessage): void {
    // Every message type handled here carries a string value.
    if (this._pc !== pc || typeof message.value !== 'string') {
      return;
    }

    if (isServerErrorForMode(message, 'webrtc')) {
      this._context.callbacks.failedCallback('server_error');
      return;
    }

    switch (message.type) {
      case 'webrtc/answer':
        pc.setRemoteDescription({ type: 'answer', sdp: message.value }).catch(() => {});
        break;

      case 'webrtc/candidate':
        if (message.value) {
          // The server sends no sdpMid; max-bundle puts every track on m-line 0.
          pc.addIceCandidate({ candidate: message.value, sdpMid: '0' }).catch(() => {});
        }
        break;
    }
  }

  private _handleConnectionStateChange(pc: RTCPeerConnection): void {
    if (this._pc !== pc) {
      return;
    }

    if (pc.connectionState === 'connected') {
      this._attachStream(pc);
    } else if (pc.connectionState === 'failed') {
      // Only 'failed' is terminal. 'disconnected' is a recoverable ICE blip
      // that usually returns to 'connected' on its own, so failing on it would
      // turn a brief network hiccup into a needless reconnect; a disconnect
      // that never recovers stops delivering frames and is caught by the
      // frame-stall watchdog instead.
      this._context.callbacks.failedCallback('media_error');
    }
  }

  private _attachStream(pc: RTCPeerConnection): void {
    if (this._stream) {
      return;
    }

    const tracks = pc
      .getTransceivers()
      .filter((transceiver) => transceiver.currentDirection === 'recvonly')
      .map((transceiver) => transceiver.receiver.track);

    const stream = this._createMediaStream(tracks);
    this._stream = stream;

    this._context.target.video.addEventListener('loadeddata', this._loadedHandler, {
      once: true,
    });
    this._context.target.video.srcObject = stream;
  }
}
