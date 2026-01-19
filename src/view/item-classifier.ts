import {
  EventViewMedia,
  RecordingViewMedia,
  ReviewViewMedia,
  ViewFolder,
  ViewItem,
  ViewMedia,
} from './item';

export class ViewItemClassifier {
  public static isMedia(item?: ViewItem | null): item is ViewMedia {
    return item instanceof ViewMedia;
  }
  public static isFolder(item?: ViewItem | null): item is ViewFolder {
    return item instanceof ViewFolder;
  }
  public static isEvent(item?: ViewItem | null): item is EventViewMedia {
    return this.isMedia(item) && (this.isClip(item) || this.isSnapshot(item));
  }
  public static isRecording(item?: ViewItem | null): item is RecordingViewMedia {
    return this.isMedia(item) && item.getMediaType() === 'recording';
  }
  public static isReview(item?: ViewItem | null): item is ReviewViewMedia {
    return this.isMedia(item) && item.getMediaType() === 'review';
  }
  public static isClip(item?: ViewItem | null): boolean {
    return this.isMedia(item) && item.getMediaType() === 'clip';
  }
  public static isSnapshot(item?: ViewItem | null): boolean {
    return this.isMedia(item) && item.getMediaType() === 'snapshot';
  }
  public static isVideo(item?: ViewItem | null): boolean {
    return (
      this.isMedia(item) &&
      (this.isClip(item) ||
        this.isRecording(item) ||
        // Reviews always have a video.
        this.isReview(item))
    );
  }
  public static supportsTimeline(item?: ViewItem | null): item is ViewMedia {
    return this.isMedia(item) && !!item.getStartTime();
  }
}
