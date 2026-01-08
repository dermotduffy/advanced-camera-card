import { NonEmptyTuple } from 'type-fest';
import { CameraManager } from '../camera-manager/manager';
import {
  CapabilitySearchKeys,
  EventQuery,
  QueryType,
  RecordingQuery,
  ReviewQuery,
} from '../camera-manager/types';
import { FoldersManager } from '../card-controller/folders/manager';
import { FolderPathComponent, FolderQuery } from '../card-controller/folders/types';
import { CameraMediaType } from '../config/schema/cameras';
import { FolderConfig } from '../config/schema/folders';
import { QuerySource } from '../query-source.js';
import { VIEW_MEDIA_TYPES, ViewMediaType } from '../types';
import { arrayify } from '../utils/basic';
import { QueryNode, UnifiedQuery } from '../view/unified-query';

interface MediaQueryBuildOptions {
  start?: Date;
  end?: Date;
  limit?: number;
}

interface FilterQueryBuildOptions extends MediaQueryBuildOptions {
  favorite?: boolean;
  tags?: Set<string>;
  what?: Set<string>;
  where?: Set<string>;
  reviewed?: boolean;
}

interface QueryLimitOptions {
  limit?: number;
}

export interface MediaTypeSpec {
  mediaType: 'events' | 'recordings' | 'reviews' | 'folder';
  eventsSubtype?: 'clips' | 'snapshots';
}

export const MediaTypeSpec = {
  clips: (): MediaTypeSpec => ({ mediaType: 'events', eventsSubtype: 'clips' }),
  snapshots: (): MediaTypeSpec => ({ mediaType: 'events', eventsSubtype: 'snapshots' }),
  events: (): MediaTypeSpec => ({ mediaType: 'events' }),
  recordings: (): MediaTypeSpec => ({ mediaType: 'recordings' }),
  reviews: (): MediaTypeSpec => ({ mediaType: 'reviews' }),
} as const;

/**
 * UnifiedQueryBuilder builds UnifiedQuery objects containing QueryNode[]. This
 * is the single place where UI concepts (like "clips") are translated to strict
 * data queries (EventQuery with hasClip: true).
 *
 * Related: UnifiedQueryRunner routes them to managers.
 *
 * Note on code coverage: Throughout this class, _buildBaseQueryNode and similar
 * methods return null only when cameraIDs is empty. Public methods guard
 * against empty cameraIDs before calling these internal methods, making the
 * null branches unreachable. Istanbul ignore comments reference this note.
 */
export class UnifiedQueryBuilder {
  private _cameraManager: CameraManager;
  private _foldersManager: FoldersManager;

  constructor(cameraManager: CameraManager, foldersManager: FoldersManager) {
    this._cameraManager = cameraManager;
    this._foldersManager = foldersManager;
  }

  // =========================================================================
  // Simple Query Builders
  // =========================================================================

  public buildClipsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    return this._buildEventsQuery(cameraIDs, { hasClip: true }, options);
  }

  public buildSnapshotsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    return this._buildEventsQuery(cameraIDs, { hasSnapshot: true }, options);
  }

  public buildEventsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    return this._buildEventsQuery(cameraIDs, {}, options);
  }

  private _buildEventsQuery(
    cameraIDs: Set<string>,
    eventOptions?: { hasClip?: boolean; hasSnapshot?: boolean },
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    const query = this._addNode(
      new UnifiedQuery(),
      this._buildEventQueryNode(cameraIDs, eventOptions, options),
    );
    return query.hasNodes() ? query : null;
  }

  private _addNode(
    query: UnifiedQuery,
    nodes?: QueryNode | QueryNode[] | null,
  ): UnifiedQuery {
    if (nodes) {
      arrayify(nodes).forEach((node) => query.addNode(node));
    }
    return query;
  }

  private _buildEventQueryNode(
    cameraIDs: Set<string>,
    eventOptions?: { hasClip?: boolean; hasSnapshot?: boolean },
    options?: MediaQueryBuildOptions,
  ): EventQuery | null {
    return this._buildBaseQueryNode(QueryType.Event, cameraIDs, options, eventOptions);
  }

  public buildRecordingsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    if (!cameraIDs.size) {
      return null;
    }

    const query = this._addNode(
      new UnifiedQuery(),
      this._buildRecordingsQueryNode(cameraIDs, options),
    );
    /* istanbul ignore next: see class note on code coverage -- @preserve */
    return query.hasNodes() ? query : null;
  }

  private _buildRecordingsQueryNode(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): RecordingQuery | null {
    return this._buildBaseQueryNode(QueryType.Recording, cameraIDs, options);
  }

  public buildReviewsQuery(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions & { reviewed?: boolean },
  ): UnifiedQuery | null {
    const query = this._addNode(
      new UnifiedQuery(),
      this._buildReviewsQueryNode(cameraIDs, options),
    );
    return query.hasNodes() ? query : null;
  }

  private _buildReviewsQueryNode(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions & { reviewed?: boolean },
  ): ReviewQuery | null {
    return this._buildBaseQueryNode(QueryType.Review, cameraIDs, options, {
      reviewed: options?.reviewed,
    });
  }

  private _buildBaseQueryNode(
    type: QueryType.Event,
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
    extraProps?: { hasClip?: boolean; hasSnapshot?: boolean },
  ): EventQuery | null;
  private _buildBaseQueryNode(
    type: QueryType.Recording,
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): RecordingQuery | null;
  private _buildBaseQueryNode(
    type: QueryType.Review,
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
    extraProps?: { reviewed?: boolean },
  ): ReviewQuery | null;
  private _buildBaseQueryNode(
    type: QueryType.Event | QueryType.Recording | QueryType.Review,
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
    extraProps?: { hasClip?: boolean; hasSnapshot?: boolean; reviewed?: boolean },
  ): EventQuery | RecordingQuery | ReviewQuery | null {
    if (!cameraIDs.size) {
      return null;
    }

    return {
      source: QuerySource.Camera,
      type,
      cameraIDs,
      ...this._mergeDefaultsForCameras(cameraIDs, type),
      ...this._extractCommonOptions(options),
      ...extraProps,
    };
  }

  // =========================================================================
  // Filter Query Builders
  // =========================================================================

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
      for (const mediaType of effectiveMediaTypes) {
        const node = this._buildFilterQueryNode(mediaType, effectiveCameraIDs, options);
        /* istanbul ignore next: see class note on code coverage -- @preserve */
        if (node) {
          query.addNode(node);
        }
      }
    }

    /* istanbul ignore next: see class note on code coverage -- @preserve */
    return query.hasNodes() ? query : null;
  }

  private _buildFilterQueryNode(
    mediaType: ViewMediaType,
    cameraIDs: Set<string>,
    options?: FilterQueryBuildOptions,
  ): EventQuery | RecordingQuery | ReviewQuery | null {
    const filterProps = {
      ...(options?.favorite !== undefined && { favorite: options.favorite }),
      ...(options?.tags && { tags: options.tags }),
      ...(options?.what && { what: options.what }),
      ...(options?.where && { where: options.where }),
    };

    switch (mediaType) {
      case 'clips': {
        const node = this._buildBaseQueryNode(QueryType.Event, cameraIDs, options, {
          hasClip: true,
        });
        /* istanbul ignore next: see class note on code coverage -- @preserve */
        return node ? { ...node, ...filterProps } : null;
      }
      case 'snapshots': {
        const node = this._buildBaseQueryNode(QueryType.Event, cameraIDs, options, {
          hasSnapshot: true,
        });
        /* istanbul ignore next: see class note on code coverage -- @preserve */
        return node ? { ...node, ...filterProps } : null;
      }
      case 'recordings': {
        const node = this._buildBaseQueryNode(QueryType.Recording, cameraIDs, options);
        /* istanbul ignore next: see class note on code coverage -- @preserve */
        return node ? { ...node, ...filterProps } : null;
      }
      case 'reviews': {
        const node = this._buildBaseQueryNode(QueryType.Review, cameraIDs, options, {
          reviewed: options?.reviewed,
        });
        /* istanbul ignore next: see class note on code coverage -- @preserve */
        return node ? { ...node, ...filterProps } : null;
      }
    }
  }

  // =========================================================================
  // Folder Query Builders
  // =========================================================================

  public buildFolderQueryWithPath(
    folder: FolderConfig,
    path: NonEmptyTuple<FolderPathComponent>,
    options?: QueryLimitOptions,
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

  public buildDefaultFolderQuery(
    folderID?: string,
    options?: QueryLimitOptions,
  ): UnifiedQuery | null {
    const query = new UnifiedQuery();
    this._addNode(query, this._buildFolderQueryNode(folderID, options));
    return query.hasNodes() ? query : null;
  }

  private _buildFolderQueryNode(
    folderID?: string,
    options?: QueryLimitOptions,
  ): QueryNode | null {
    const folder = this._foldersManager.getFolder(folderID);
    const params = folder && this._foldersManager.getDefaultQueryParameters(folder);
    return params
      ? {
          ...params,
          ...options,
        }
      : null;
  }

  // =========================================================================
  // Default Query Builders
  // =========================================================================

  public buildDefaultCameraQuery(
    cameraID?: string,
    options?: QueryLimitOptions,
  ): UnifiedQuery | null {
    const cameraIDs = cameraID
      ? this._cameraManager.getStore().getAllDependentCameras(cameraID)
      : this._cameraManager.getStore().getCameraIDs();

    const query = new UnifiedQuery();
    for (const cameraID of cameraIDs) {
      this._addNode(query, this._buildDefaultCameraQueryNodes(cameraID, options));
    }
    return query.hasNodes() ? query : null;
  }

  private _buildDefaultCameraQueryNodes(
    cameraID: string,
    options?: QueryLimitOptions,
  ): QueryNode | QueryNode[] | null {
    const mediaConfig = this._cameraManager.getStore().getCameraConfig(cameraID)?.media;
    const spec = this._resolveMediaTypeSpec(
      cameraID,
      mediaConfig?.type,
      mediaConfig?.events_type,
    );
    if (!spec) {
      return null;
    }

    return this._buildQueryNodesCapabilityUnchecked(spec, new Set([cameraID]), {
      limit: options?.limit,
    });
  }

  // =========================================================================
  // Advanced Query Builders
  // =========================================================================

  public buildCameraMediaQuery(
    spec: MediaTypeSpec,
    options?: QueryLimitOptions & {
      cameraID?: string;
    },
  ): UnifiedQuery | null {
    let neededCapability: CapabilitySearchKeys;
    switch (spec.mediaType) {
      case 'events':
        switch (spec.eventsSubtype) {
          case 'clips':
          case 'snapshots':
            neededCapability = spec.eventsSubtype;
            break;
          default:
            neededCapability = { anyCapabilities: ['clips', 'snapshots'] };
            break;
        }
        break;
      case 'recordings':
      case 'reviews':
        neededCapability = spec.mediaType;
        break;
      case 'folder':
        // Folders are handled separately by buildDefaultFolderQuery.
        return null;
    }

    const cameraIDs = options?.cameraID
      ? this._cameraManager
          .getStore()
          .getAllDependentCameras(options.cameraID, neededCapability)
      : this._cameraManager.getStore().getCameraIDsWithCapability(neededCapability);

    const query = new UnifiedQuery();
    this._addNode(
      query,
      this._buildQueryNodesCapabilityUnchecked(spec, cameraIDs, options),
    );
    return query.hasNodes() ? query : null;
  }

  private _resolveMediaTypeSpec(
    cameraID: string,
    type?: CameraMediaType,
    eventsType?: 'clips' | 'snapshots' | 'all',
  ): MediaTypeSpec | null {
    const capabilities = this._cameraManager.getCameraCapabilities(cameraID);
    if (!capabilities) {
      return null;
    }

    const hasReviews = capabilities.has('reviews');
    const hasClips = capabilities.has('clips');
    const hasSnapshots = capabilities.has('snapshots');
    const hasRecordings = capabilities.has('recordings');

    // Auto mode: priority cascade
    if (!type || type === 'auto') {
      if (hasReviews) {
        return MediaTypeSpec.reviews();
      }
      if (hasClips) {
        return MediaTypeSpec.clips();
      }
      if (hasSnapshots) {
        return MediaTypeSpec.snapshots();
      }
      if (hasRecordings) {
        return MediaTypeSpec.recordings();
      }
      return null;
    }

    // Explicit type mode
    switch (type) {
      case 'recordings':
        return hasRecordings ? MediaTypeSpec.recordings() : null;
      case 'reviews':
        return hasReviews ? MediaTypeSpec.reviews() : null;
      case 'events':
        if (eventsType === 'all' && hasClips && hasSnapshots) {
          return MediaTypeSpec.events();
        }
        if ((eventsType === 'all' || eventsType === 'clips') && hasClips) {
          return MediaTypeSpec.clips();
        }
        if ((eventsType === 'all' || eventsType === 'snapshots') && hasSnapshots) {
          return MediaTypeSpec.snapshots();
        }
        return null;
      default:
        return null;
    }
  }

  private _buildQueryNodesCapabilityUnchecked(
    spec: MediaTypeSpec,
    cameraIDs: Set<string>,
    options?: QueryLimitOptions,
  ): QueryNode | QueryNode[] | null {
    switch (spec.mediaType) {
      case 'events':
        switch (spec.eventsSubtype) {
          case 'clips':
            return this._buildEventQueryNode(cameraIDs, { hasClip: true }, options);
          case 'snapshots':
            return this._buildEventQueryNode(cameraIDs, { hasSnapshot: true }, options);
          default:
            return this._buildEventQueryNode(cameraIDs, {}, options);
        }
      case 'recordings':
        return this._buildRecordingsQueryNode(cameraIDs, options);
      case 'reviews':
        return this._buildReviewsQueryNode(cameraIDs, options);
    }
    // istanbul ignore next -- @preserve
    return null;
  }

  // =========================================================================
  // Private Utility Helpers
  // =========================================================================

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
