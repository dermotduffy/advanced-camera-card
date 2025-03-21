import { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher';
import { CameraConfig } from '../../config/schema/cameras';
import { HomeAssistant } from '../../ha/types';
import { canonicalizeHAURL } from '../../utils/ha';
import { BrowseMediaManager } from '../../utils/ha/browse-media/browse-media-manager';
import { BROWSE_MEDIA_CACHE_SECONDS } from '../../utils/ha/browse-media/types';
import { EntityRegistryManager } from '../../utils/ha/registry/entity';
import { ResolvedMediaCache, resolveMedia } from '../../utils/ha/resolved-media';
import { ViewMedia } from '../../view/media';
import { RequestCache } from '../cache';
import { CameraManagerEngine } from '../engine';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import { CameraManagerReadOnlyConfigStore } from '../store';
import {
  CameraEndpoint,
  CameraEventCallback,
  CameraManagerMediaCapabilities,
  DataQuery,
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
  protected _browseMediaManager: BrowseMediaManager;
  protected _entityRegistryManager: EntityRegistryManager;
  protected _resolvedMediaCache: ResolvedMediaCache;
  protected _requestCache: RequestCache;

  public constructor(
    entityRegistryManager: EntityRegistryManager,
    stateWatcher: StateWatcherSubscriptionInterface,
    browseMediaManager: BrowseMediaManager,
    resolvedMediaCache: ResolvedMediaCache,
    requestCache: RequestCache,
    eventCallback?: CameraEventCallback,
  ) {
    super(stateWatcher, eventCallback);
    this._entityRegistryManager = entityRegistryManager;
    this._browseMediaManager = browseMediaManager;
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
  ): Promise<CameraEndpoint | null> {
    const contentID = media.getContentID();
    if (!contentID) {
      return null;
    }
    const resolvedMedia = await resolveMedia(hass, contentID, this._resolvedMediaCache);
    return resolvedMedia
      ? { endpoint: canonicalizeHAURL(hass, resolvedMedia.url) }
      : null;
  }

  public getQueryResultMaxAge(query: DataQuery): number | null {
    if (query.type === QueryType.Event) {
      return BROWSE_MEDIA_CACHE_SECONDS;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getMediaCapabilities(_media: ViewMedia): CameraManagerMediaCapabilities {
    return {
      canFavorite: false,
      canDownload: true,
    };
  }
}
