import { fromUnixTime } from 'date-fns';
import { isEqual } from 'lodash-es';
import { CameraConfig } from '../../config/schema/cameras';
import { Severity } from '../../types';
import {
  EventViewMedia,
  RecordingViewMedia,
  ReviewViewMedia,
  VideoContentType,
  ViewMedia,
  ViewMediaType,
} from '../../view/item';
import { FrigateEvent, FrigateRecording, FrigateReview } from './types';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingID,
  getRecordingMediaContentID,
  getRecordingTitle,
  getReviewMediaContentID,
  getReviewSeverity,
  getReviewThumbnailURL,
  getReviewTitle,
} from './util';

export class FrigateEventViewMedia extends ViewMedia implements EventViewMedia {
  protected _event: FrigateEvent;
  protected _contentID: string;
  protected _thumbnail: string;
  protected _subLabels: string[] | null;

  constructor(
    mediaType: ViewMediaType,
    cameraID: string,
    event: FrigateEvent,
    contentID: string,
    thumbnail: string,
    // See 'A note on Frigate sub_labels' in engine-frigate.ts for more
    // details about why sub-labels are treated specially. By taking in
    // subLabels as an array here, we can keep a single place that splits
    // sublabels (`_splitSubLabels` in engine-frigate.ts).
    subLabels?: string[],
  ) {
    super(mediaType, { cameraID });
    this._event = event;
    this._contentID = contentID;
    this._thumbnail = thumbnail;
    this._subLabels = subLabels ?? null;
  }

  public getStartTime(): Date {
    return fromUnixTime(this._event.start_time);
  }
  public getEndTime(): Date | null {
    return this._event.end_time ? fromUnixTime(this._event.end_time) : null;
  }
  public inProgress(): boolean | null {
    // In Frigate, events/recordings always have end times unless they are in
    // progress.
    return !this.getEndTime();
  }
  public getVideoContentType(): VideoContentType | null {
    return VideoContentType.HLS;
  }
  public getID(): string {
    return this._event.id;
  }
  public getContentID(): string {
    return this._contentID;
  }
  public getTitle(): string | null {
    return getEventTitle(this._event);
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
  public isFavorite(): boolean | null {
    return this._event.retain_indefinitely ?? null;
  }
  public setFavorite(favorite: boolean): void {
    this._event.retain_indefinitely = favorite;
  }
  public getWhat(): string[] | null {
    return [this._event.label];
  }
  public getWhere(): string[] | null {
    const zones = this._event.zones;
    return zones.length ? zones : null;
  }
  public getScore(): number | null {
    return this._event.top_score;
  }
  public getTags(): string[] | null {
    return this._subLabels;
  }
  public isGroupableWith(that: EventViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }
}

export class FrigateRecordingViewMedia extends ViewMedia implements RecordingViewMedia {
  protected _recording: FrigateRecording;
  protected _id: string;
  protected _contentID: string;
  protected _title: string;

  constructor(
    mediaType: ViewMediaType,
    cameraID: string,
    recording: FrigateRecording,
    id: string,
    contentID: string,
    title: string,
  ) {
    super(mediaType, { cameraID });
    this._recording = recording;
    this._id = id;
    this._contentID = contentID;
    this._title = title;
  }

  public getID(): string {
    return this._id;
  }
  public getStartTime(): Date {
    return this._recording.startTime;
  }
  public getEndTime(): Date {
    return this._recording.endTime;
  }
  public inProgress(): boolean | null {
    // In Frigate, events/recordings always have end times unless they are in
    // progress.
    return !this.getEndTime();
  }
  public getVideoContentType(): VideoContentType | null {
    return VideoContentType.HLS;
  }
  public getContentID(): string | null {
    return this._contentID;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getEventCount(): number {
    return this._recording.events;
  }
}

export class FrigateReviewViewMedia extends ViewMedia implements ReviewViewMedia {
  protected _review: FrigateReview;
  protected _contentID: string;
  protected _thumbnail: string | null;
  protected _title: string;

  constructor(
    cameraID: string,
    review: FrigateReview,
    contentID: string,
    thumbnail: string | null,
    title: string,
  ) {
    super(ViewMediaType.Review, { cameraID });
    this._review = review;
    this._contentID = contentID;
    this._thumbnail = thumbnail;
    this._title = title;
  }

  public getID(): string {
    return this._review.id;
  }
  public getStartTime(): Date {
    return fromUnixTime(this._review.start_time);
  }
  public getEndTime(): Date | null {
    return this._review.end_time ? fromUnixTime(this._review.end_time) : null;
  }
  public inProgress(): boolean | null {
    return !this.getEndTime();
  }
  public getVideoContentType(): VideoContentType | null {
    return VideoContentType.HLS;
  }
  public getContentID(): string | null {
    return this._contentID;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
  public getSeverity(): Severity | null {
    return getReviewSeverity(this._review.severity);
  }
  public isReviewed(): boolean {
    return !!this._review.has_been_reviewed;
  }
  public setReviewed(reviewed: boolean): void {
    this._review.has_been_reviewed = reviewed;
  }
  public getWhat(): string[] | null {
    return this._review.data.objects ?? null;
  }
  public getWhere(): string[] | null {
    const zones = this._review.data.zones;
    return zones?.length ? zones : null;
  }
}

export class FrigateViewMediaFactory {
  static createEventViewMedia(
    mediaType: ViewMediaType,
    cameraID: string,
    cameraConfig: CameraConfig,
    event: FrigateEvent,
    subLabels?: string[],
  ): FrigateEventViewMedia | null {
    if (
      (mediaType === 'clip' && !event.has_clip) ||
      (mediaType === 'snapshot' && !event.has_snapshot) ||
      !cameraConfig.frigate.client_id ||
      !cameraConfig.frigate.camera_name
    ) {
      return null;
    }

    return new FrigateEventViewMedia(
      mediaType,
      cameraID,
      event,
      getEventMediaContentID(
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
        event,
        mediaType === 'clip' ? 'clips' : 'snapshots',
      ),
      getEventThumbnailURL(cameraConfig.frigate.client_id, event),
      subLabels,
    );
  }

  static createRecordingViewMedia(
    cameraID: string,
    recording: FrigateRecording,
    cameraConfig: CameraConfig,
    cameraTitle: string,
  ): FrigateRecordingViewMedia | null {
    if (!cameraConfig.frigate.client_id || !cameraConfig.frigate.camera_name) {
      return null;
    }

    return new FrigateRecordingViewMedia(
      ViewMediaType.Recording,
      cameraID,
      recording,
      getRecordingID(cameraConfig, recording),
      getRecordingMediaContentID(
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
        recording,
      ),
      getRecordingTitle(cameraTitle, recording),
    );
  }

  static createReviewViewMedia(
    cameraID: string,
    review: FrigateReview,
    cameraConfig: CameraConfig,
  ): FrigateReviewViewMedia | null {
    if (!cameraConfig.frigate.client_id || !cameraConfig.frigate.camera_name) {
      return null;
    }

    return new FrigateReviewViewMedia(
      cameraID,
      review,
      getReviewMediaContentID(
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
        review,
      ),
      getReviewThumbnailURL(cameraConfig.frigate.client_id, review),
      getReviewTitle(review),
    );
  }
}
