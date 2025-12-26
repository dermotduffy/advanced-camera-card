import { ViewMedia } from '../../view/item';
import {
  FrigateEventViewMedia,
  FrigateRecordingViewMedia,
  FrigateReviewViewMedia,
} from './media';

export class FrigateViewMediaClassifier {
  public static isFrigateMedia(
    media: ViewMedia,
  ): media is
    | FrigateEventViewMedia
    | FrigateRecordingViewMedia
    | FrigateReviewViewMedia {
    return (
      this.isFrigateEvent(media) ||
      this.isFrigateRecording(media) ||
      this.isFrigateReview(media)
    );
  }
  public static isFrigateEvent(media: ViewMedia): media is FrigateEventViewMedia {
    return media instanceof FrigateEventViewMedia;
  }
  public static isFrigateRecording(
    media: ViewMedia,
  ): media is FrigateRecordingViewMedia {
    return media instanceof FrigateRecordingViewMedia;
  }
  public static isFrigateReview(media: ViewMedia): media is FrigateReviewViewMedia {
    return media instanceof FrigateReviewViewMedia;
  }
}
