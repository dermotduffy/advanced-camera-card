import type { Lane, StreamProfile } from '../types';

// Choose which lane to present when both a WebRTC stream and a binary-lane
// stream (MSE, MP4, MJPEG) are available for the same camera. The factors are
// compared in order of decreasing significance -- the first one that differs
// decides, regardless of the rest:
//   1. Has video -- a camera view needs a picture before anything else.
//   2. Has audio -- a complete stream over a silent one.
//   3. H.265 over H.264 -- better quality per bitrate.
// If all three are equal the tie goes to WebRTC, which plays as it arrives
// (lower latency for a live view) rather than from a buffer.
export const getPreferredSource = (
  webrtc: StreamProfile,
  binary: StreamProfile,
): Lane => {
  // WebRTC audio is observed from live tracks; the binary side's audio comes
  // from MSE's negotiated codec string, where only AAC plays reliably, so only
  // AAC counts as audio on the binary side here (see StreamProfile).
  const factors: [boolean, boolean][] = [
    [webrtc.hasVideo, binary.hasVideo],
    [webrtc.hasAudio, binary.hasAACAudio],
    [webrtc.hasH265Video, binary.hasH265Video],
  ];

  for (const [webRTCHas, binaryHas] of factors) {
    if (webRTCHas !== binaryHas) {
      return webRTCHas ? 'webrtc' : 'binary';
    }
  }
  return 'webrtc';
};
