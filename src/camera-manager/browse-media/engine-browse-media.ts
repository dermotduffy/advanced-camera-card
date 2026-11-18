import type { HASSManagerReadonlyInterface } from '../../card-controller/hass/types';
import { BROWSE_MEDIA_CACHE_SECONDS } from '../../ha/browse-media/types';
import type { BrowseMediaWalker } from '../../ha/browse-media/walker';
import { getMediaDownloadPath } from '../../ha/download';
import type { EntityRegistryManager } from '../../ha/registry/entity/types';
import type { ResolvedMediaCache } from '../../ha/resolved-media';
import type { HomeAssistant } from '../../ha/types';
import { QuerySource } from '../../query-source.js';
import type { Endpoint } from '../../types';
import type { ViewMedia } from '../../view/item';
import type { ViewItemCapabilities } from '../../view/types';
import type { Camera } from '../camera';
import type { CameraManagerEngine } from '../engine';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import type { CameraManagerReadOnlyConfigStore } from '../store';
import {
  QueryType,
  type CameraEventCallback,
  type CameraManagerRequestCache,
  type CameraQuery,
  type EventQuery,
  type PartialEventQuery,
} from '../types';

/**
 * A base class for cameras that read events from HA BrowseMedia interface.
 */
export class BrowseMediaCameraManagerEngine
  extends GenericCameraManagerEngine
  implements CameraManagerEngine
{
  protected _browseMediaWalker: BrowseMediaWalker;
  protected _entityRegistryManager: EntityRegistryManager;
  protected _resolvedMediaCache: ResolvedMediaCache;
  protected _requestCache: CameraManagerRequestCache;

  public constructor(
    entityRegistryManager: EntityRegistryManager,
    hassManager: HASSManagerReadonlyInterface,
    browseMediaManager: BrowseMediaWalker,
    resolvedMediaCache: ResolvedMediaCache,
    requestCache: CameraManagerRequestCache,
    eventCallback?: CameraEventCallback,
  ) {
    super(hassManager, entityRegistryManager, eventCallback);
    this._entityRegistryManager = entityRegistryManager;
    this._browseMediaWalker = browseMediaManager;
    this._resolvedMediaCache = resolvedMediaCache;
    this._requestCache = requestCache;
  }

  public generateDefaultEventQuery(
    _store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null {
    return [
      {
        source: QuerySource.Camera,
        type: QueryType.Event,
        cameraIDs: cameraIDs,
        ...query,
      },
    ];
  }

  public async getMediaDownloadPath(
    hass: HomeAssistant,
    _camera: Camera,
    media: ViewMedia,
  ): Promise<Endpoint | null> {
    return getMediaDownloadPath(hass, media.getContentID(), this._resolvedMediaCache);
  }

  public getQueryResultMaxAge(query: CameraQuery): number | null {
    if (query.type === QueryType.Event) {
      return BROWSE_MEDIA_CACHE_SECONDS;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getMediaCapabilities(_media: ViewMedia): ViewItemCapabilities {
    return {
      canFavorite: false,
      canDownload: true,
    };
  }
}
