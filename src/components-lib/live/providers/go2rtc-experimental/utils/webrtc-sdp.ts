// The SDP (Session Description Protocol) is the text blob describing a WebRTC
// session's media. go2rtc advertises an H.265 track with this rtpmap encoding
// name, so its presence in the answer SDP means the browser negotiated H.265 --
// preferred over H.264 when choosing between the WebRTC and MSE streams (see
// https://github.com/dermotduffy/advanced-camera-card/issues/2200).
export const sdpHasH265 = (sdp: string): boolean => sdp.includes('H265/90000');
