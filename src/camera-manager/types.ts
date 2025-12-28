import { ExpiringEqualityCache } from '../cache/expiring-cache';
import { SSLCiphers } from '../config/schema/cameras';
import { AdvancedCameraCardView } from '../config/schema/common/const';
import { CapabilityKey, Endpoint, Icon, Severity } from '../types';
import { ViewMedia } from '../view/item';

// ====
// Base
// ====

export enum QueryType {
  Event = 'event-query',
  Recording = 'recording-query',
  RecordingSegments = 'recording-segments-query',
  MediaMetadata = 'media-metadata',
  Review = 'review-query',
}

export enum QueryResultsType {
  Event = 'event-results',
  Recording = 'recording-results',
  RecordingSegments = 'recording-segments-results',
  MediaMetadata = 'media-metadata-results',
  Review = 'review-results',
}

export enum Engine {
  Frigate = 'frigate',
  Generic = 'generic',
  MotionEye = 'motioneye',
  Reolink = 'reolink',
  TPLink = 'tplink',
}

export interface CameraQuery {
  type: QueryType;
  cameraIDs: Set<string>;
}
export type PartialCameraQuery = Partial<CameraQuery>;

interface TimeBasedDataQuery {
  start: Date;
  end: Date;
}

interface LimitedDataQuery {
  limit: number;
}

export interface MediaQuery
  extends CameraQuery,
    Partial<TimeBasedDataQuery>,
    Partial<LimitedDataQuery> {
  favorite?: boolean;
}

export interface QueryResults {
  type: QueryResultsType;
  engine: Engine;
  expiry?: Date;
  cached?: boolean;
}

// Generic recording segment type (inspired by Frigate recording segments).
export interface RecordingSegment {
  start_time: number;
  end_time: number;
  id: string;
}

export type QueryReturnType<QT> = QT extends EventQuery
  ? EventQueryResults
  : QT extends RecordingQuery
    ? RecordingQueryResults
    : QT extends RecordingSegmentsQuery
      ? RecordingSegmentsQueryResults
      : QT extends MediaMetadataQuery
        ? MediaMetadataQueryResults
        : QT extends ReviewQuery
          ? ReviewQueryResults
          : never;
export type PartialQueryConcreteType<PQT> = PQT extends PartialEventQuery
  ? EventQuery
  : PQT extends PartialRecordingQuery
    ? RecordingQuery
    : PQT extends PartialRecordingSegmentsQuery
      ? RecordingSegmentsQuery
      : PQT extends PartialReviewQuery
        ? ReviewQuery
        : never;

export type ResultsMap<QT> = Map<QT, QueryReturnType<QT>>;
export type EventQueryResultsMap = ResultsMap<EventQuery>;
export type RecordingQueryResultsMap = ResultsMap<RecordingQuery>;
export type RecordingSegmentsQueryResultsMap = ResultsMap<RecordingSegmentsQuery>;
export type MediaMetadataQueryResultsMap = ResultsMap<MediaMetadataQuery>;

export interface MediaMetadata {
  days?: Set<string>;
  tags?: Set<string>;
  where?: Set<string>;
  what?: Set<string>;
}

interface CapabilitySearchAllAny {
  allCapabilities?: CapabilityKey[];
  anyCapabilities?: CapabilityKey[];
}
export type CapabilitySearchKeys = CapabilityKey | CapabilitySearchAllAny;
export interface CapabilitySearchOptions {
  inclusive?: boolean;
}

export interface CameraManagerCameraMetadata {
  title: string;
  icon: Icon;

  // Engine icon is just a string since it will never be entity-derived.
  engineIcon?: string;
}

export interface CameraEndpointsContext {
  media?: ViewMedia;
  view?: AdvancedCameraCardView;
}

export interface CameraEndpoints {
  ui?: Endpoint;
  go2rtc?: Endpoint;
  jsmpeg?: Endpoint;
  webrtcCard?: Endpoint;
}

export interface CameraProxyConfig {
  dynamic: boolean;
  live: boolean;
  media: boolean;
  ssl_verification: boolean;
  ssl_ciphers: SSLCiphers;
}

export interface EngineOptions {
  useCache?: boolean;
}

export interface CameraEvent {
  cameraID: string;

  type: 'new' | 'update' | 'end';

  // When fidelity is `high`, the engine is assumed to provide exact details of
  // what new media is available. Otherwise all media types are assumed to be
  // possibly newly available.
  fidelity?: 'high' | 'low';

  // Whether new media may be available.
  clip?: boolean;
  snapshot?: boolean;
  review?: boolean;
}
export type CameraEventCallback = (ev: CameraEvent) => void;

export class CameraManagerRequestCache extends ExpiringEqualityCache<
  CameraQuery,
  QueryResults
> {}

// ===========
// Event Query
// ===========

export interface EventQuery extends MediaQuery {
  type: QueryType.Event;

  // Frigate equivalent: has_snapshot
  hasSnapshot?: boolean;

  // Frigate equivalent: has_clip
  hasClip?: boolean;

  // Frigate equivalent: label
  what?: Set<string>;

  // Frigate equivalent: sub_label
  tags?: Set<string>;

  // Frigate equivalent: zone
  where?: Set<string>;
}
export type PartialEventQuery = Partial<EventQuery>;

export interface EventQueryResults extends QueryResults {
  type: QueryResultsType.Event;
}

// ===============
// Recording Query
// ===============

export interface RecordingQuery extends MediaQuery {
  type: QueryType.Recording;
}
export type PartialRecordingQuery = Partial<RecordingQuery>;

export interface RecordingQueryResults extends QueryResults {
  type: QueryResultsType.Recording;
}

// ========================
// Recording Segments Query
// ========================

export interface RecordingSegmentsQuery extends CameraQuery, TimeBasedDataQuery {
  type: QueryType.RecordingSegments;
}
export type PartialRecordingSegmentsQuery = Partial<RecordingSegmentsQuery>;

export interface RecordingSegmentsQueryResults extends QueryResults {
  type: QueryResultsType.RecordingSegments;
  segments: RecordingSegment[];
}

// ====================
// Media metadata Query
// ====================

export interface MediaMetadataQuery extends CameraQuery {
  type: QueryType.MediaMetadata;
}

export interface MediaMetadataQueryResults extends QueryResults {
  type: QueryResultsType.MediaMetadata;
  metadata: MediaMetadata;
}

// ============
// Review Query
// ============

export interface ReviewQuery extends MediaQuery {
  type: QueryType.Review;

  // Frigate equivalent: label (objects detected)
  what?: Set<string>;

  // Frigate equivalent: zone
  where?: Set<string>;

  severity?: Severity;

  // Whether to include reviewed items (default: false = unreviewed only)
  reviewed?: boolean;
}
export type PartialReviewQuery = Partial<ReviewQuery>;

export interface ReviewQueryResults extends QueryResults {
  type: QueryResultsType.Review;
}

export type ReviewQueryResultsMap = ResultsMap<ReviewQuery>;
