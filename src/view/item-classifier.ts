import {
  EventViewMedia,
  RecordingViewMedia,
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
  public static isClip(item?: ViewItem | null): boolean {
    return this.isMedia(item) && item.getMediaType() === 'clip';
  }
  public static isSnapshot(item?: ViewItem | null): boolean {
    return this.isMedia(item) && item.getMediaType() === 'snapshot';
  }
  public static isVideo(item?: ViewItem | null): boolean {
    return this.isMedia(item) && (this.isClip(item) || this.isRecording(item));
  }
}
