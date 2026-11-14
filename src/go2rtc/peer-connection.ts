// go2rtc sends its ICE candidates without an `sdpMid`, so the card attaches each
// one to the first media section (`sdpMid: '0'`). Bundling carries every track
// over that section's transport, so those candidates serve all of them.
export const GO2RTC_PEER_CONNECTION_CONFIG: RTCConfiguration = {
  bundlePolicy: 'max-bundle',
};
