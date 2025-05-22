import { ViewItem } from '../view/item';
import { ViewItemClassifier } from '../view/item-classifier';

/**
 * Find the longest matching media object that contains a given targetTime.
 * Longest is chosen to give the most stability to the media viewer.
 * @param mediaArray The media.
 * @param targetTime The target time used to find the relevant child.
 * @returns The childindex or null if no matching child is found.
 */
export const findBestMediaTimeIndex = (
  mediaArray: ViewItem[],
  targetTime: Date,
  favorCameraID?: string,
): number | null => {
  let bestMatch:
    | {
        index: number;
        duration: number;
        cameraID: string | null;
      }
    | undefined;

  for (const [i, media] of mediaArray.entries()) {
    if (!ViewItemClassifier.isMedia(media)) {
      continue;
    }
    const start = media.getStartTime();
    const end = media.getUsableEndTime();

    if (media.includesTime(targetTime) && start && end) {
      const duration = end.getTime() - start.getTime();

      if (
        // No best match so far ...
        !bestMatch ||
        // ... or there is a best-match, but it's from a non-favored camera (unlike this one) ...
        (favorCameraID &&
          bestMatch.cameraID !== favorCameraID &&
          media.getCameraID() === favorCameraID) ||
        // ... or this match is longer and either there's no favored camera or this is it.
        (duration > bestMatch.duration &&
          (!favorCameraID ||
            bestMatch.cameraID !== favorCameraID ||
            media.getCameraID() === favorCameraID))
      ) {
        bestMatch = { index: i, duration: duration, cameraID: media.getCameraID() };
      }
    }
  }
  return bestMatch ? bestMatch.index : null;
};
