import { NonEmptyTuple } from 'type-fest';
import { CameraManager, CameraQueryClassifier } from '../camera-manager/manager';
import {
  EventQuery,
  QueryType,
  RecordingQuery,
  ReviewQuery,
} from '../camera-manager/types';
import { FolderPathComponent, FolderQuery } from '../card-controller/folders/types';
import { FolderConfig } from '../config/schema/folders';
import { QuerySource } from '../query-source.js';
import { VIEW_MEDIA_TYPES, ViewMediaType } from '../types';
import { UnifiedQuery } from '../view/unified-query';

export interface MediaQueryBuildOptions {
  start?: Date;
  end?: Date;
  limit?: number;
}

export interface FilterQueryBuildOptions {
  start?: Date;
  end?: Date;
  limit?: number;
  favorite?: boolean;
  tags?: Set<string>;
  what?: Set<string>;
  where?: Set<string>;
  reviewed?: boolean;
}

/**
 * UnifiedQueryBuilder builds UnifiedQuery objects containing QueryNode[]. This
 * is the single place where UI concepts (like "clips") are translated to strict
 * data queries (EventQuery with hasClip: true).
 *
 * Related: UnifiedQueryRunner routes them to managers.
 */
export class UnifiedQueryBuilder {
  private _cameraManager: CameraManager;

  constructor(cameraManager: CameraManager) {
    this._cameraManager = cameraManager;
  }

  public buildClipsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    return this._buildEventQuery(cameraIDs, { hasClip: true }, options);
  }

  public buildSnapshotsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    return this._buildEventQuery(cameraIDs, { hasSnapshot: true }, options);
  }

  public buildEventsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    return this._buildEventQuery(cameraIDs, {}, options);
  }

  private _buildEventQuery(
    cameraIDs: Set<string>,
    eventOptions?: { hasClip?: boolean; hasSnapshot?: boolean },
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    if (!cameraIDs.size) {
      return null;
    }

    const query = new UnifiedQuery();

    const eventQuery: EventQuery = {
      source: QuerySource.Camera,
      type: QueryType.Event,
      cameraIDs,
      ...this._mergeDefaultsForCameras(cameraIDs, QueryType.Event),
      ...eventOptions,
      ...this._extractCommonOptions(options),
    };

    query.addNode(eventQuery);
    return query;
  }

  public buildRecordingsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    if (!cameraIDs.size) {
      return null;
    }

    const query = new UnifiedQuery();

    const recordingQuery: RecordingQuery = {
      source: QuerySource.Camera,
      type: QueryType.Recording,
      cameraIDs,
      ...this._mergeDefaultsForCameras(cameraIDs, QueryType.Recording),
      ...this._extractCommonOptions(options),
    };

    query.addNode(recordingQuery);
    return query;
  }

  public buildReviewsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions & { reviewed?: boolean },
  ): UnifiedQuery | null {
    if (!cameraIDs.size) {
      return null;
    }

    const query = new UnifiedQuery();

    const reviewQuery: ReviewQuery = {
      source: QuerySource.Camera,
      type: QueryType.Review,
      cameraIDs,
      ...this._mergeDefaultsForCameras(cameraIDs, QueryType.Review),
      ...this._extractCommonOptions(options),
      reviewed: options?.reviewed,
    };

    query.addNode(reviewQuery);
    return query;
  }

  public getAllMediaCapableCameraIDs(): Set<string> {
    return this._cameraManager.getStore().getCameraIDsWithCapability({
      anyCapabilities: ['clips', 'snapshots', 'recordings', 'reviews'],
    });
  }

  public buildFilterQuery(
    cameraIDs: Set<string> | null,
    mediaTypes: Set<ViewMediaType> | null,
    options?: FilterQueryBuildOptions,
  ): UnifiedQuery | null {
    const query = new UnifiedQuery();

    // Default to all cameras if none specified
    const effectiveCameraIDs = cameraIDs?.size
      ? cameraIDs
      : this.getAllMediaCapableCameraIDs();

    // Default to all media types if none specified
    const effectiveMediaTypes = mediaTypes?.size
      ? mediaTypes
      : new Set<ViewMediaType>(VIEW_MEDIA_TYPES);

    // Build camera-based media queries (when cameras are available)
    if (effectiveCameraIDs.size) {
      const commonProps = {
        cameraIDs: effectiveCameraIDs,
        ...(options?.start && { start: options.start }),
        ...(options?.end && { end: options.end }),
        ...(options?.limit !== undefined && { limit: options.limit }),
        ...(options?.favorite !== undefined && { favorite: options.favorite }),
        ...(options?.tags && { tags: options.tags }),
        ...(options?.what && { what: options.what }),
        ...(options?.where && { where: options.where }),
      };

      for (const mediaType of effectiveMediaTypes) {
        switch (mediaType) {
          case 'clips': {
            const eventQuery: EventQuery = {
              source: QuerySource.Camera,
              type: QueryType.Event,
              ...commonProps,
              hasClip: true,
            };
            query.addNode(eventQuery);
            break;
          }
          case 'snapshots': {
            const eventQuery: EventQuery = {
              source: QuerySource.Camera,
              type: QueryType.Event,
              ...commonProps,
              hasSnapshot: true,
            };
            query.addNode(eventQuery);
            break;
          }
          case 'recordings': {
            const recordingQuery: RecordingQuery = {
              source: QuerySource.Camera,
              type: QueryType.Recording,
              ...commonProps,
            };
            query.addNode(recordingQuery);
            break;
          }
          case 'reviews': {
            const reviewQuery: ReviewQuery = {
              source: QuerySource.Camera,
              type: QueryType.Review,
              ...commonProps,
              ...(options?.reviewed !== undefined && { reviewed: options.reviewed }),
            };
            query.addNode(reviewQuery);
            break;
          }
        }
      }
    }

    return query.hasNodes() ? query : null;
  }

  public buildFolderQuery(
    folder: FolderConfig,
    path: NonEmptyTuple<FolderPathComponent>,
    options?: { limit?: number },
  ): UnifiedQuery {
    const query = new UnifiedQuery();
    const folderQuery: FolderQuery = {
      source: QuerySource.Folder,
      folder,
      path,
      ...(options?.limit !== undefined && { limit: options.limit }),
    };
    query.addNode(folderQuery);
    return query;
  }

  private _extractCommonOptions(options?: MediaQueryBuildOptions): {
    start?: Date;
    end?: Date;
    limit?: number;
  } {
    return {
      ...(options?.start && { start: options.start }),
      ...(options?.end && { end: options.end }),
      ...(options?.limit !== undefined && { limit: options.limit }),
    };
  }

  private _mergeDefaultsForCameras(
    cameraIDs: Set<string>,
    queryType: QueryType,
  ): { what?: Set<string>; where?: Set<string> } {
    const what: string[] = [];
    const where: string[] = [];

    for (const cameraID of cameraIDs) {
      const defaults = this._cameraManager.getDefaultQueryParameters(
        cameraID,
        queryType,
      );
      if (defaults?.what) {
        what.push(...defaults.what);
      }
      if (defaults?.where) {
        where.push(...defaults.where);
      }
    }

    return {
      ...(what.length && { what: new Set(what) }),
      ...(where.length && { where: new Set(where) }),
    };
  }
}

/**
 * Static utility methods for cloning and transforming existing UnifiedQuery
 * objects. Unlike UnifiedQueryBuilder, these don't require state (e.g. a
 * CameraManager).
 */
export class UnifiedQueryTransformer {
  static stripTimeRange(query: UnifiedQuery): UnifiedQuery {
    const nodes = query.getNodes().map((node) => {
      if (node.source !== QuerySource.Camera) {
        return node;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { start, end, ...rest } = node;
      return rest;
    });
    return new UnifiedQuery(nodes);
  }

  static rebuildQuery(
    query: UnifiedQuery,
    options: MediaQueryBuildOptions,
  ): UnifiedQuery {
    const commonOptions = {
      ...(options?.start && { start: options.start }),
      ...(options?.end && { end: options.end }),
      ...(options?.limit !== undefined && { limit: options.limit }),
    };
    const nodes = query.getNodes().map((node) => {
      if (node.source === QuerySource.Camera) {
        return {
          ...node,
          ...commonOptions,
        };
      }
      return node;
    });
    return new UnifiedQuery(nodes);
  }

  static convertToClips(query: UnifiedQuery): UnifiedQuery {
    const nodes = query
      .getNodes()
      .map((node) =>
        node.source === QuerySource.Camera && CameraQueryClassifier.isEventQuery(node)
          ? { ...node, hasClip: true, hasSnapshot: undefined }
          : node,
      );
    return new UnifiedQuery(nodes);
  }
}
