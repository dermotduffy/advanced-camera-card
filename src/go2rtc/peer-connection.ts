export type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;

export const GO2RTC_PEER_CONNECTION_CONFIG: RTCConfiguration = {
  bundlePolicy: 'max-bundle',
  iceServers: [
    {
      // Two public STUN servers so connectivity survives one being unreachable.
      urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
    },
  ],
};

export const createBrowserPeerConnection: PeerConnectionFactory = (config) =>
  new RTCPeerConnection(config);
