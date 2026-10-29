import type { ViewMedia } from './item.js';
import type { View } from './view.js';

interface MediaSeekTarget {
  time: Date;

  // Whether the media covers `time`. Only a seek requested by the view can fall
  // outside the media: the media's own playback start time never does.
  inMedia: boolean;
}

/**
 * The time the media viewer seeks to in a media item: the seek requested by the
 * view, or else the media's own playback start time.
 */
export const getMediaSeekTarget = (
  view: View | null,
  media: ViewMedia,
): MediaSeekTarget | null => {
  const requestedSeek = view?.context?.mediaViewer?.seek ?? null;
  if (requestedSeek) {
    return { time: requestedSeek, inMedia: media.includesTime(requestedSeek) };
  }

  const playbackStartTime = media.getPlaybackStartTime();
  return playbackStartTime ? { time: playbackStartTime, inMedia: true } : null;
};
