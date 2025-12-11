export interface AudioProperties {
  mozHasAudio?: boolean;
  audioTracks?: unknown[];
}

// There is currently no consistent cross-browser modern way to determine if a
// video element has audio tracks. The below will work in ~24% of browsers, but
// notably not in Chrome. There used to be a usable
// `webkitAudioDecodedByteCount` property, but this now seems to be consistently
// 0 in Chrome. This generously defaults to assuming there is audio when we
// cannot rule it out.
export const mayHaveAudio = (video: HTMLVideoElement & AudioProperties): boolean => {
  if (video.mozHasAudio !== undefined) {
    return video.mozHasAudio;
  }
  if (video.audioTracks !== undefined) {
    return Boolean(video.audioTracks?.length);
  }
  // Check MediaStream audio tracks (reliable for WebRTC at load time)
  if (typeof MediaStream !== 'undefined' && video.srcObject instanceof MediaStream) {
    return video.srcObject.getAudioTracks().length > 0;
  }
  return true;
};
