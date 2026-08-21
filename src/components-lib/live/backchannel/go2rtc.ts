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
import { Generation } from '../../../utils/concurrency/generation';
import { Timer } from '../../../utils/timer';
import { convertToWebSocketURL } from '../../../utils/websocket-url';
import {
  BackchannelError,
  type Backchannel,
  type BackchannelErrorCallback,
} from './types';

const BACKCHANNEL_CONNECT_TIMEOUT_SECONDS = 10;

interface PendingStart {
  resolve: () => void;
  reject: (error: BackchannelError) => void;
}

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
export class Go2RTCBackchannel implements Backchannel {
  private _hass: HomeAssistant;
  private _endpoint: Endpoint;
  private _proxyConfig: EnabledProxyConfig | null;
  private _options: Go2RTCBackchannelOptions | null;

  private _pc: RTCPeerConnection | null = null;
  private _channel: SignalingChannel | null = null;
  private _transceiver: RTCRtpTransceiver | null = null;
  private _unsubscribeCallbacks: UnsubscribeCallback[] = [];
  private _connectTimer = new Timer();
  private _generation = new Generation();

  // `start()` cannot determine its own outcome: the camera is only known to be
  // reachable once the peer connection reports `connected`, and go2rtc may
  // refuse in a message that arrives even later. Whichever handler learns the
  // outcome completes `start()` through these.
  private _pendingStart: PendingStart | null = null;

  constructor(
    hass: HomeAssistant,
    endpoint: Endpoint,
    proxyConfig?: EnabledProxyConfig,
    options?: Go2RTCBackchannelOptions,
  ) {
    this._hass = hass;
    this._endpoint = endpoint;
    this._proxyConfig = proxyConfig ?? null;
    this._options = options ?? null;
  }

  public async start(stream: MediaStream): Promise<void> {
    this.stop();

    const generation = this._generation.next();

    // A microphone stream carries exactly one audio track.
    const track = stream.getAudioTracks()[0] ?? null;
    if (!track || track.readyState === 'ended') {
      throw new BackchannelError('failed');
    }

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

    const pc = (this._options?.createPeerConnection ?? createBrowserPeerConnection)(
      GO2RTC_PEER_CONNECTION_CONFIG,
    );
    this._pc = pc;

    // This connection only sends audio.
    this._transceiver = pc.addTransceiver(track, { direction: 'sendonly' });

    const channel = new SignalingChannel(
      convertToWebSocketURL(resolvedURL.url),
      {
        openCallback: () => this._negotiate(pc, channel, generation),
        disconnectCallback: () => this._handleDisconnect(generation),
      },
      { createWebSocket: this._options?.createWebSocket },
    );
    this._channel = channel;

    await new Promise<void>((resolve, reject) => {
      this._pendingStart = { resolve, reject };

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
      pc.addEventListener('connectionstatechange', () =>
        this._handleConnectionStateChange(pc, generation),
      );

      this._connectTimer.start(BACKCHANNEL_CONNECT_TIMEOUT_SECONDS, () =>
        this._failStart(generation, new BackchannelError('failed')),
      );

      channel.connect();
    });
  }

  public async setStream(stream: MediaStream): Promise<void> {
    const transceiver = this._transceiver;

    // Nothing to swap onto: the call this belonged to has already ended.
    if (!transceiver) {
      return;
    }

    // A microphone stream carries exactly one audio track. Detaching the sender
    // instead would leave the user believing they can be heard.
    const track = stream.getAudioTracks()[0] ?? null;
    if (!track || track.readyState === 'ended') {
      throw new BackchannelError('failed');
    }

    await transceiver.sender.replaceTrack(track);
  }

  public stop(): void {
    this._generation.invalidate();
    this._connectTimer.stop();

    const pendingStart = this._pendingStart;
    this._pendingStart = null;

    this._unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
    this._unsubscribeCallbacks = [];

    this._channel?.close();
    this._channel = null;

    // Closing the peer connection is what makes go2rtc release the camera's
    // backchannel. The outbound track keeps running: MicrophoneManager owns the
    // microphone and shares it across cameras.
    // See https://github.com/dermotduffy/advanced-camera-card/issues/1810
    this._pc?.close();
    this._pc = null;
    this._transceiver = null;

    pendingStart?.reject(new BackchannelError('abandoned'));
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
    // go2rtc refuses a stream it cannot send audio to with an error frame
    // rather than an answer.
    if (isServerErrorForMode(message, 'webrtc')) {
      this._failStart(
        generation,
        new BackchannelError('no_two_way_audio', message.value),
      );
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

  private _handleConnectionStateChange(pc: RTCPeerConnection, generation: number): void {
    if (!this._generation.isCurrent(generation)) {
      return;
    }

    if (pc.connectionState === 'connected') {
      const direction = this._transceiver?.currentDirection;
      if (direction !== 'sendonly' && direction !== 'sendrecv') {
        this._failStart(generation, new BackchannelError('no_two_way_audio'));
        return;
      }

      this._connectTimer.stop();

      // Signaling is finished, and the camera's backchannel belongs to the peer
      // connection rather than to this socket. Leaving it open would let a
      // proxy drop it as idle much later, which `_handleDisconnect` reports as
      // a failure.
      this._channel?.close();
      this._channel = null;

      this._pendingStart?.resolve();
      this._pendingStart = null;
    } else if (pc.connectionState === 'failed') {
      const error = new BackchannelError('failed');

      if (this._pendingStart) {
        this._failStart(generation, error);
        return;
      }

      // `start()` already resolved, so there is no request left to fail and the
      // call is under way. Its video and inbound audio ride a different
      // connection and are unaffected, so the call continues and only the loss
      // of outbound audio is reported. Tearing down still matters: closing the
      // dead peer connection is what releases the camera's backchannel.
      this.stop();
      this._options?.errorCallback?.(error);
    }
  }

  // Aborts an in-progress `start()`. Every failure before `start()` resolves
  // arrives here; afterwards there is no request left to fail.
  private _failStart(generation: number, error: BackchannelError): void {
    if (!this._generation.isCurrent(generation)) {
      return;
    }
    // Taken before the teardown so this reason is reported rather than the
    // abandonment `stop()` would otherwise report.
    const pendingStart = this._pendingStart;
    this._pendingStart = null;
    this.stop();
    pendingStart?.reject(error);
  }
}
