import {
  getWebRTCClientConfiguration,
  webrtcOfferEventSchema,
} from '../../../ha/camera-webrtc';
import type { HomeAssistant } from '../../../ha/types';
import { getErrorDescription } from '../../../utils/basic';
import {
  createBrowserPeerConnection,
  type PeerConnectionFactory,
} from '../../../utils/peer-connection';
import { PeerConnectionBackchannel } from './peer-connection';
import { BackchannelError, type BackchannelErrorCallback } from './types';

export interface HABackchannelOptions {
  createPeerConnection?: PeerConnectionFactory;
  errorCallback?: BackchannelErrorCallback;
}

// Carries microphone audio to a camera over a WebRTC connection of its own,
// negotiated through Home Assistant's camera WebRTC API (`camera/webrtc/offer`)
// and separate from whatever is carrying video. Home Assistant closes the
// session when its subscription ends, so the camera's audio backchannel is
// held only for the duration of a call.
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
    const { configuration, dataChannel } = await getWebRTCClientConfiguration(
      this._hass,
      this._entityID,
    );
    if (!this._generation.isCurrent(generation)) {
      return;
    }

    const pc = this._createPeerConnection(
      this._options?.createPeerConnection ?? createBrowserPeerConnection,
      configuration,
      track,
      generation,
    );

    // Some cameras only answer an offer that carries the data channel their
    // WebRTC provider names.
    if (dataChannel) {
      pc.createDataChannel(dataChannel);
    }

    pc.addEventListener('icecandidate', (ev) => {
      // An empty candidate only marks the end of ICE candidate gathering and
      // carries no route to the camera, so there is nothing to send.
      if (this._generation.isCurrent(generation) && ev.candidate?.candidate) {
        this._sendCandidate(ev.candidate);
      }
    });

    const offer = await pc.createOffer();
    if (!this._generation.isCurrent(generation)) {
      return;
    }
    await pc.setLocalDescription(offer);
    if (!this._generation.isCurrent(generation)) {
      return;
    }

    // Home Assistant closes the session, without telling the browser, when its
    // websocket closes, and cannot attach the session to a new websocket.
    // A disconnect therefore ends the call, and the subscription is not renewed.
    // After a reconnect, the websocket library reuses command ids, so calling
    // this subscription's unsubscribe would end whichever subscription now
    // holds its id.
    let disconnected = false;
    const handleDisconnected = (): void => {
      disconnected = true;
      this._unsubscribe = null;
      this._reportLost(generation, new BackchannelError('disconnected'));
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
      return;
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

    // A rejected candidate removes only one possible route to the camera. The
    // peer connection's state still shows whether any other route connects.
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
        // its mid. The microphone's audio is this connection's first media
        // line, so such a candidate is attached to it.
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
