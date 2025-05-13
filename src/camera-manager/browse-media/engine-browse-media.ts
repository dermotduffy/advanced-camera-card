import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { CameraConfig } from '../../config/schema/cameras';
import { BROWSE_MEDIA_CACHE_SECONDS } from '../../ha/browse-media/types';
import { BrowseMediaWalker } from '../../ha/browse-media/walker';
import { getMediaDownloadPath } from '../../ha/download';
import { EntityRegistryManager } from '../../ha/registry/entity/types';
import { ResolvedMediaCache } from '../../ha/resolved-media';
import { HomeAssistant } from '../../ha/types';
import { Endpoint } from '../../types';
import { ViewMedia } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';
import { CameraManagerEngine } from '../engine';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import { CameraManagerReadOnlyConfigStore } from '../store';
import {
  CameraEventCallback,
  CameraManagerRequestCache,
  CameraQuery,
  EventQuery,
  PartialEventQuery,
  QueryType,
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
    stateWatcher: StateWatcherSubscriptionInterface,
    browseMediaManager: BrowseMediaWalker,
    resolvedMediaCache: ResolvedMediaCache,
    requestCache: CameraManagerRequestCache,
    eventCallback?: CameraEventCallback,
  ) {
    super(stateWatcher, eventCallback);
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
        type: QueryType.Event,
        cameraIDs: cameraIDs,
        ...query,
      },
    ];
  }

  public async getMediaDownloadPath(
    hass: HomeAssistant,
    _cameraConfig: CameraConfig,
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
