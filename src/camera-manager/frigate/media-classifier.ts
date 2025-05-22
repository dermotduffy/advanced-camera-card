import { ViewMedia } from '../../view/item';
import { FrigateEventViewMedia, FrigateRecordingViewMedia } from './media';

export class FrigateViewMediaClassifier {
  public static isFrigateMedia(
    media: ViewMedia,
  ): media is FrigateEventViewMedia | FrigateRecordingViewMedia {
    return this.isFrigateEvent(media) || this.isFrigateRecording(media);
  }
  public static isFrigateEvent(media: ViewMedia): media is FrigateEventViewMedia {
    return media instanceof FrigateEventViewMedia;
  }
  public static isFrigateRecording(
    media: ViewMedia,
  ): media is FrigateRecordingViewMedia {
    return media instanceof FrigateRecordingViewMedia;
  }
}
