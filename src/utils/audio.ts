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

/**
 * Determine if audio is available for a go2rtc stream.
 * @param pc The RTCPeerConnection (for WebRTC streams).
 * @param mseCodecs The negotiated MSE codecs string (for MSE streams).
 * @param video The video element (fallback for browser-based detection).
 * @returns True if audio is available.
 */
export const hasAudio = (
  video: HTMLVideoElement & AudioProperties,
  pc?: RTCPeerConnection | null,
  mseCodecs?: string,
): boolean => {
  // For WebRTC: Check if there's an audio receiver with an active track.
  // We check that the track is not muted because muted means no media data
  // is flowing (e.g., the source isn't producing audio). It is not related to
  // the audio being muted by the user on the receiving end.
  if (pc) {
    const receivers = pc.getReceivers();

    // Only trust receivers if they're populated (connection established)
    if (receivers.length > 0) {
      return receivers.some(
        (receiver) => receiver.track?.kind === 'audio' && !receiver.track?.muted,
      );
    }
  }
  // For MSE: Check negotiated codecs for audio codecs
  if (mseCodecs) {
    return (
      mseCodecs.includes('mp4a') ||
      mseCodecs.includes('opus') ||
      mseCodecs.includes('flac')
    );
  }
  // Fallback to browser-based detection (unreliable in Chrome)
  return mayHaveAudio(video);
};

/**
 * Check if a WebRTC peer connection has an outbound audio channel (i.e. 2-way
 * audio / microphone support).
 * @param pc The RTCPeerConnection to check.
 * @returns True if the connection has an audio transceiver configured to send.
 */
export const has2WayAudio = (pc: RTCPeerConnection | null): boolean => {
  return !!pc
    ?.getTransceivers()
    .some(
      (tr) =>
        tr.sender.track?.kind === 'audio' &&
        (tr.direction === 'sendonly' || tr.direction === 'sendrecv'),
    );
};

export type AudioTracksMuteStateCleanup = (() => void) | null;

/**
 * Add listeners for mute/unmute events on all audio tracks in a WebRTC connection.
 * The callback is fired when the aggregate mute state changes between:
 * - All tracks unmuted (hasAudio = true)
 * - All tracks muted (hasAudio = false)
 * Mixed states (some muted, some unmuted) do not trigger the callback.
 * @param pc The RTCPeerConnection to monitor.
 * @param handler Callback fired with `true` when ALL tracks become unmuted,
 *                `false` when ALL tracks become muted.
 * @returns A cleanup function to remove listeners, or null if no audio tracks.
 */
export const addAudioTracksMuteStateListener = (
  pc: RTCPeerConnection | null,
  handler: (hasAudio: boolean) => void,
): AudioTracksMuteStateCleanup => {
  if (!pc) {
    return null;
  }

  const audioTracks = pc
    .getReceivers()
    .map((r) => r.track)
    .filter((t): t is MediaStreamTrack => t?.kind === 'audio');

  if (audioTracks.length === 0) {
    return null;
  }

  const hasAnyUnmuted = () => audioTracks.some((t) => !t.muted);
  let lastHasAudio = hasAnyUnmuted();

  const _handler = () => {
    const nowHasAudio = hasAnyUnmuted();
    if (nowHasAudio !== lastHasAudio) {
      lastHasAudio = nowHasAudio;
      handler(nowHasAudio);
    }
  };

  audioTracks.forEach((track) => {
    track.addEventListener('unmute', _handler);
    track.addEventListener('mute', _handler);
  });

  return () =>
    audioTracks.forEach((track) => {
      track.removeEventListener('unmute', _handler);
      track.removeEventListener('mute', _handler);
    });
};
