export type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;

export const createBrowserPeerConnection: PeerConnectionFactory = (config) =>
  new RTCPeerConnection(config);
