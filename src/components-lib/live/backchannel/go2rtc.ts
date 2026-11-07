import type { EnabledProxyConfig } from '../../../config/schema/common/proxy';
import { isServerErrorForMode, type Go2RTCMessage } from '../../../go2rtc/messages';
import {
  createBrowserPeerConnection,
  GO2RTC_PEER_CONNECTION_CONFIG,
  type PeerConnectionFactory,
} from '../../../go2rtc/peer-connection';
import { SignalingChannel, type WebSocketFactory } from '../../../go2rtc/signaling';
import { resolveEndpointURL } from '../../../ha/resolve-endpoint';
import type { HomeAssistant } from '../../../ha/types';
import type { Endpoint, UnsubscribeCallback } from '../../../types';
import { getErrorDescription } from '../../../utils/basic';
import { convertToWebSocketURL } from '../../../utils/websocket-url';
import { PeerConnectionBackchannel } from './peer-connection';
import { BackchannelError, type BackchannelErrorCallback } from './types';

export interface Go2RTCBackchannelOptions {
  createWebSocket?: WebSocketFactory;
  createPeerConnection?: PeerConnectionFactory;
  errorCallback?: BackchannelErrorCallback;
}

// Carries microphone audio to a camera over its own WebRTC connection to
// go2rtc, separate from whatever is carrying video. go2rtc claims the camera's
// audio backchannel when this connection's offer arrives and releases it when
// the connection closes, so the camera is occupied only for the duration of a
// call.
// See: https://github.com/dermotduffy/advanced-camera-card/discussions/2678
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2691
export class Go2RTCBackchannel extends PeerConnectionBackchannel {
  private _hass: HomeAssistant;
  private _endpoint: Endpoint;
  private _proxyConfig: EnabledProxyConfig | null;
  private _options: Go2RTCBackchannelOptions | null;

  private _channel: SignalingChannel | null = null;
  private _unsubscribeCallbacks: UnsubscribeCallback[] = [];

  constructor(
    hass: HomeAssistant,
    endpoint: Endpoint,
    proxyConfig?: EnabledProxyConfig,
    options?: Go2RTCBackchannelOptions,
  ) {
    super(options?.errorCallback);
    this._hass = hass;
    this._endpoint = endpoint;
    this._proxyConfig = proxyConfig ?? null;
    this._options = options ?? null;
  }

  protected async _connect(track: MediaStreamTrack, generation: number): Promise<void> {
    const resolvedURL = await resolveEndpointURL(this._hass, this._endpoint, {
      proxyConfig: this._proxyConfig,
      proxyEndpointOptions: { websocket: true },
    });
    if (!this._generation.isCurrent(generation)) {
      throw new BackchannelError('abandoned');
    }
    if (!resolvedURL.success) {
      throw new BackchannelError('failed', resolvedURL.error);
    }

    const pc = this._createPeerConnection(
      this._options?.createPeerConnection ?? createBrowserPeerConnection,
      GO2RTC_PEER_CONNECTION_CONFIG,
      track,
      generation,
    );

    const channel = new SignalingChannel(
      convertToWebSocketURL(resolvedURL.url),
      {
        openCallback: () => this._negotiate(pc, channel, generation),
        disconnectCallback: () => this._handleDisconnect(generation),
      },
      { createWebSocket: this._options?.createWebSocket },
    );
    this._channel = channel;

    this._unsubscribeCallbacks.push(
      channel.subscribeToMessages((message) =>
        this._handleMessage(pc, message, generation),
      ),
    );
    pc.addEventListener('icecandidate', (ev) => {
      if (!this._generation.isCurrent(generation)) {
        return;
      }
      // An empty value signals end-of-candidates.
      channel.send({
        type: 'webrtc/candidate',
        value: ev.candidate ? ev.candidate.candidate : '',
      });
    });

    channel.connect();
  }

  protected _closeSignaling(): void {
    this._unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this._unsubscribeCallbacks = [];

    this._channel?.close();
    this._channel = null;
  }

  protected _handleConnected(): void {
    // Signaling is finished, and the camera's backchannel belongs to the peer
    // connection rather than to this socket. Leaving it open would let a
    // proxy drop it as idle much later, which `_handleDisconnect` reports as
    // a failure.
    this._channel?.close();
    this._channel = null;
  }

  private async _negotiate(
    pc: RTCPeerConnection,
    channel: SignalingChannel,
    generation: number,
  ): Promise<void> {
    try {
      const offer = await pc.createOffer();
      if (!this._generation.isCurrent(generation)) {
        return;
      }
      await pc.setLocalDescription(offer);
      if (!this._generation.isCurrent(generation)) {
        return;
      }
      channel.send({ type: 'webrtc/offer', value: offer.sdp ?? '' });
    } catch (error: unknown) {
      this._failStart(
        generation,
        new BackchannelError('failed', getErrorDescription(error) ?? undefined),
      );
    }
  }

  private _handleMessage(
    pc: RTCPeerConnection,
    message: Go2RTCMessage,
    generation: number,
  ): void {
    // The error frame go2rtc sends in place of an answer does not identify what
    // failed, so the reason can be no more specific than `failed`, with the
    // server's text attached as the description.
    if (isServerErrorForMode(message, 'webrtc')) {
      this._failStart(generation, new BackchannelError('failed', message.value));
      return;
    }

    if (typeof message.value !== 'string') {
      return;
    }

    switch (message.type) {
      case 'webrtc/answer':
        pc.setRemoteDescription({ type: 'answer', sdp: message.value }).catch(
          (error: unknown) =>
            this._failStart(
              generation,
              new BackchannelError('failed', getErrorDescription(error) ?? undefined),
            ),
        );
        break;

      case 'webrtc/candidate':
        if (message.value) {
          // The server sends no sdpMid; max-bundle puts every track on m-line 0.
          pc.addIceCandidate({ candidate: message.value, sdpMid: '0' }).catch(() => {});
        }
        break;
    }
  }

  private _handleDisconnect(generation: number): void {
    // This socket is closed deliberately once the peer connection is
    // established, so a close arriving here is always premature: the offer and
    // answer travel over it and cannot complete without it.
    this._failStart(generation, new BackchannelError('failed'));
  }
}
