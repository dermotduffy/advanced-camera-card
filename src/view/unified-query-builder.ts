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
import { QueryFilters, QuerySource } from '../query-source.js';
import { VIEW_MEDIA_TYPES, ViewMediaType } from '../types';
import { arrayify } from '../utils/basic';
import { QueryNode, UnifiedQuery } from '../view/unified-query';
import { getReviewedQueryFilterFromConfig } from './utils/query-filter';

interface MediaQueryBuildOptions extends QueryFilters {
  start?: Date;
  end?: Date;
  limit?: number;
}

interface QueryFiltersOptions extends QueryFilters {
  limit?: number;
}

type MediaType = 'events' | 'recordings' | 'reviews' | 'folder';

export interface MediaTypeSpec {
  mediaType: MediaType;
  eventsSubtype?: 'clips' | 'snapshots';
}

export const MediaTypeSpec = {
  clips: (): MediaTypeSpec => ({ mediaType: 'events', eventsSubtype: 'clips' }),
  events: (): MediaTypeSpec => ({ mediaType: 'events' }),
  folder: (): MediaTypeSpec => ({ mediaType: 'folder' }),
  recordings: (): MediaTypeSpec => ({ mediaType: 'recordings' }),
  reviews: (): MediaTypeSpec => ({ mediaType: 'reviews' }),
  snapshots: (): MediaTypeSpec => ({ mediaType: 'events', eventsSubtype: 'snapshots' }),
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
    options?: MediaQueryBuildOptions,
  ): UnifiedQuery | null {
    const query = this._addNode(
      new UnifiedQuery(),
      this._buildReviewsQueryNode(cameraIDs, options),
    );
    return query.hasNodes() ? query : null;
  }

  private _buildReviewsQueryNode(
    cameraIDs: Set<string>,
    options?: MediaQueryBuildOptions,
  ): ReviewQuery | null {
    return this._buildBaseQueryNode(QueryType.Review, cameraIDs, options);
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
      ...this._extractFilterOptions(options),
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
    options?: MediaQueryBuildOptions,
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
    options?: MediaQueryBuildOptions,
  ): EventQuery | RecordingQuery | ReviewQuery | null {
    switch (mediaType) {
      case 'clips':
        return this._buildBaseQueryNode(QueryType.Event, cameraIDs, options, {
          hasClip: true,
        });
      case 'snapshots':
        return this._buildBaseQueryNode(QueryType.Event, cameraIDs, options, {
          hasSnapshot: true,
        });
      case 'recordings':
        return this._buildBaseQueryNode(QueryType.Recording, cameraIDs, options);
      case 'reviews':
        return this._buildBaseQueryNode(QueryType.Review, cameraIDs, options);
    }
  }

  // =========================================================================
  // Folder Query Builders
  // =========================================================================

  public buildFolderQueryWithPath(
    folder: FolderConfig,
    path: NonEmptyTuple<FolderPathComponent>,
    options?: QueryFiltersOptions,
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
    options?: QueryFiltersOptions,
  ): UnifiedQuery | null {
    const query = new UnifiedQuery();
    this._addNode(query, this._buildFolderQueryNode(folderID, options));
    return query.hasNodes() ? query : null;
  }

  private _buildFolderQueryNodesForCameras(
    cameraIDs: Set<string>,
    options?: QueryFiltersOptions,
  ): QueryNode[] {
    const nodes: QueryNode[] = [];
    for (const cameraID of cameraIDs) {
      const mediaConfig = this._cameraManager
        .getStore()
        .getCameraConfig(cameraID)?.media;
      for (const folderID of mediaConfig?.folders ?? [undefined]) {
        const node = this._buildFolderQueryNode(folderID, options);
        if (node) {
          nodes.push(node);
        }
      }
    }
    return nodes;
  }

  private _buildFolderQueryNode(
    folderID?: string,
    options?: QueryFiltersOptions,
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
    options?: QueryFiltersOptions,
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
    options?: QueryFiltersOptions,
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

    return this._buildQueryNodesCapabilityUnchecked(spec, cameraID, {
      limit: options?.limit,
    });
  }

  // =========================================================================
  // Advanced Query Builders
  // =========================================================================

  public buildCameraMediaQuery(
    mediaType: MediaType,
    options?: QueryFiltersOptions & {
      cameraID?: string;
      eventsSubtype?: 'clips' | 'snapshots';
    },
  ): UnifiedQuery | null {
    if (mediaType === 'folder') {
      // Folders are handled separately by buildDefaultFolderQuery.
      return null;
    }

    // Map the simple media type to the capability required
    const neededCapability: CapabilitySearchKeys =
      mediaType === 'events'
        ? options?.eventsSubtype ?? { anyCapabilities: ['clips', 'snapshots'] }
        : mediaType;

    const cameraIDs = options?.cameraID
      ? this._cameraManager
          .getStore()
          .getAllDependentCameras(options.cameraID, neededCapability)
      : this._cameraManager.getStore().getCameraIDsWithCapability(neededCapability);

    const query = new UnifiedQuery();
    for (const cameraID of cameraIDs) {
      const cameraSpec = this._resolveMediaTypeSpec(
        cameraID,
        mediaType,
        options?.eventsSubtype,
      );
      if (!cameraSpec) {
        continue;
      }

      // For reviews, resolve the reviewed filter from camera config if not provided
      const resolvedOptions =
        cameraSpec.mediaType === 'reviews' && options?.reviewed === undefined
          ? {
              ...options,
              reviewed: getReviewedQueryFilterFromConfig(
                this._cameraManager.getStore().getCameraConfig(cameraID)?.media
                  ?.reviewed,
              ),
            }
          : options;

      this._addNode(
        query,
        this._buildQueryNodesCapabilityUnchecked(cameraSpec, cameraID, resolvedOptions),
      );
    }
    return query.hasNodes() ? query : null;
  }

  private _resolveMediaTypeSpec(
    cameraID: string,
    type?: CameraMediaType,
    eventsType?: 'clips' | 'snapshots' | 'all',
  ): MediaTypeSpec | null {
    const capabilities = this._cameraManager.getCameraCapabilities(cameraID);
    const config = this._cameraManager.getStore().getCameraConfig(cameraID);

    if (!capabilities || !config) {
      return null;
    }

    const hasReviews = capabilities.has('reviews');
    const hasClips = capabilities.has('clips');
    const hasSnapshots = capabilities.has('snapshots');
    const hasRecordings = capabilities.has('recordings');

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

    switch (type) {
      case 'recordings':
        return hasRecordings ? MediaTypeSpec.recordings() : null;
      case 'reviews':
        return hasReviews ? MediaTypeSpec.reviews() : null;
      case 'folder':
        return MediaTypeSpec.folder();
      case 'events': {
        const configEventsType = eventsType ?? config.media?.events_type;
        if (
          (!configEventsType || configEventsType === 'all') &&
          hasClips &&
          hasSnapshots
        ) {
          return MediaTypeSpec.events();
        }

        // Resolve to concrete type: prefer config, fallback to available capability
        const targetType =
          configEventsType === 'clips' || configEventsType === 'snapshots'
            ? configEventsType
            : hasClips
              ? 'clips'
              : 'snapshots';

        if (targetType === 'clips' && hasClips) {
          return MediaTypeSpec.clips();
        }
        if (targetType === 'snapshots' && hasSnapshots) {
          return MediaTypeSpec.snapshots();
        }
        return null;
      }
    }
  }

  private _buildQueryNodesCapabilityUnchecked(
    spec: MediaTypeSpec,
    cameraID: string,
    options?: QueryFiltersOptions,
  ): QueryNode | QueryNode[] | null {
    const cameraIDs = new Set([cameraID]);
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
      case 'folder': {
        return this._buildFolderQueryNodesForCameras(cameraIDs, options);
      }
    }
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

  private _extractFilterOptions(options?: QueryFilters): QueryFilters {
    return {
      ...(options?.favorite !== undefined && { favorite: options.favorite }),
      ...(options?.tags && { tags: options.tags }),
      ...(options?.what && { what: options.what }),
      ...(options?.where && { where: options.where }),
      ...(options?.reviewed !== undefined && { reviewed: options.reviewed }),
      ...(options?.severity && { severity: options.severity }),
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
