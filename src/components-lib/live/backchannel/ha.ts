import {
  createBrowserPeerConnection,
  type PeerConnectionFactory,
} from '../../../go2rtc/peer-connection';
import {
  getWebRTCClientConfiguration,
  webrtcOfferEventSchema,
} from '../../../ha/camera-webrtc';
import type { HomeAssistant } from '../../../ha/types';
import { getErrorDescription } from '../../../utils/basic';
import { PeerConnectionBackchannel } from './peer-connection';
import { BackchannelError, type BackchannelErrorCallback } from './types';

export interface HABackchannelOptions {
  createPeerConnection?: PeerConnectionFactory;
  errorCallback?: BackchannelErrorCallback;
}

// Carries microphone audio to a camera over its own WebRTC connection,
// negotiated through Home Assistant's camera WebRTC API (`camera/webrtc/offer`),
// separate from whatever is carrying video. This is the path Home Assistant's
// own two-way audio uses (2026.11): the camera's WebRTC provider claims its
// audio backchannel for this connection and releases it when the session
// closes, so the camera is occupied only for the duration of a call.
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2852
export class HABackchannel extends PeerConnectionBackchannel {
  private _hass: HomeAssistant;
  private _entityID: string;
  private _options: HABackchannelOptions | null;

  private _unsubscribe: (() => Promise<void>) | null = null;
  private _unwatchConnection: (() => void) | null = null;
  private _sessionID: string | null = null;
  // Candidates gathered before Home Assistant named the session they belong to.
  private _queuedCandidates: RTCIceCandidate[] = [];

  constructor(hass: HomeAssistant, entityID: string, options?: HABackchannelOptions) {
    super(options?.errorCallback);
    this._hass = hass;
    this._entityID = entityID;
    this._options = options ?? null;
  }

  protected async _connect(track: MediaStreamTrack, generation: number): Promise<void> {
    const configuration = await getWebRTCClientConfiguration(this._hass, this._entityID);
    if (!this._generation.isCurrent(generation)) {
      throw new BackchannelError('abandoned');
    }

    const pc = this._createPeerConnection(
      this._options?.createPeerConnection ?? createBrowserPeerConnection,
      configuration,
      track,
      generation,
    );
    pc.addEventListener('icecandidate', (ev) => {
      // An empty candidate marks the end of gathering, which Home Assistant's
      // own player does not send either.
      if (this._generation.isCurrent(generation) && ev.candidate?.candidate) {
        this._sendCandidate(ev.candidate);
      }
    });

    const offer = await pc.createOffer();
    if (!this._generation.isCurrent(generation)) {
      throw new BackchannelError('abandoned');
    }
    await pc.setLocalDescription(offer);
    if (!this._generation.isCurrent(generation)) {
      throw new BackchannelError('abandoned');
    }

    // Home Assistant closes the session when its websocket closes, without an
    // event for it, and a WebRTC session cannot be resumed on a new websocket,
    // so the subscription is not renewed and a disconnect ends the call. Its
    // unsubscribe then must not be sent: on the new connection the command id
    // it carries may belong to another subscription.
    let disconnected = false;
    const handleDisconnected = (): void => {
      disconnected = true;
      this._unsubscribe = null;
      this._reportLost(generation, new BackchannelError('failed'));
    };
    const connection = this._hass.connection;
    connection.addEventListener('disconnected', handleDisconnected);
    this._unwatchConnection = () =>
      connection.removeEventListener('disconnected', handleDisconnected);

    const unsubscribe = await connection.subscribeMessage<unknown>(
      (event) => this._handleEvent(pc, event, generation),
      { type: 'camera/webrtc/offer', entity_id: this._entityID, offer: offer.sdp ?? '' },
      { resubscribe: false },
    );
    if (!this._generation.isCurrent(generation)) {
      if (!disconnected) {
        unsubscribe().catch(() => {});
      }
      throw new BackchannelError('abandoned');
    }
    this._unsubscribe = unsubscribe;
  }

  protected _closeSignaling(): void {
    this._unwatchConnection?.();
    this._unwatchConnection = null;

    // Ending the subscription is what makes Home Assistant close the session.
    this._unsubscribe?.().catch(() => {});
    this._unsubscribe = null;
    this._sessionID = null;
    this._queuedCandidates = [];
  }

  private _sendCandidate(candidate: RTCIceCandidate): void {
    if (!this._sessionID) {
      this._queuedCandidates.push(candidate);
      return;
    }
    // A candidate Home Assistant refuses only costs that one route to the
    // camera; the connection state reports whether any route worked.
    this._hass
      .callWS({
        type: 'camera/webrtc/candidate',
        entity_id: this._entityID,
        session_id: this._sessionID,
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        },
      })
      .catch(() => {});
  }

  private _handleEvent(pc: RTCPeerConnection, raw: unknown, generation: number): void {
    if (!this._generation.isCurrent(generation)) {
      return;
    }
    const parsed = webrtcOfferEventSchema.safeParse(raw);
    if (!parsed.success) {
      return;
    }
    const event = parsed.data;

    switch (event.type) {
      case 'session': {
        this._sessionID = event.session_id;
        const queued = this._queuedCandidates;
        this._queuedCandidates = [];
        queued.forEach((candidate) => this._sendCandidate(candidate));
        break;
      }

      case 'answer':
        pc.setRemoteDescription({ type: 'answer', sdp: event.answer }).catch(
          (error: unknown) =>
            this._failStart(
              generation,
              new BackchannelError('failed', getErrorDescription(error) ?? undefined),
            ),
        );
        break;

      case 'candidate': {
        const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
        // A browser refuses a candidate that names neither its media line nor
        // its mid; max-bundle puts every track on the first, as Home
        // Assistant's own player assumes.
        pc.addIceCandidate(
          sdpMid || sdpMLineIndex != null
            ? { candidate, sdpMid: sdpMid ?? null, sdpMLineIndex: sdpMLineIndex ?? null }
            : { candidate, sdpMid: '0' },
        ).catch(() => {});
        break;
      }

      case 'error':
        this._reportLost(generation, new BackchannelError('failed', event.message));
        break;
    }
  }
}
